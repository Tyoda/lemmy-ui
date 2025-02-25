import { isAuthPath } from "@utils/app";
import { getHttpBaseInternal } from "@utils/env";
import { ErrorPageData, IsoData } from "@utils/types";
import type { Request, Response } from "express";
import { StaticRouter, matchPath } from "inferno-router";
import { Match } from "inferno-router/dist/Route";
import { renderToString } from "inferno-server";
import { GetSiteResponse, LemmyHttp, MyUserInfo } from "lemmy-js-client";
import App from "../../shared/components/app/app";
import { InitialFetchRequest, RouteData } from "@utils/types";
import { routes } from "@utils/routes";
import {
  FailedRequestState,
  wrapClient,
} from "../../shared/services/HttpService";
import { createSsrHtml } from "../utils/create-ssr-html";
import { getErrorPageData } from "../utils/get-error-page-data";
import { setForwardedHeaders } from "../utils/set-forwarded-headers";
import { getJwtCookie } from "../utils/has-jwt-cookie";
import { I18NextService, LanguageService } from "../../shared/services/";
import { parsePath } from "history";
import { getQueryString } from "@utils/helpers";
import { adultConsentCookieKey } from "@utils/config";
import { setupMarkdown } from "@utils/markdown";

export default async (req: Request, res: Response) => {
  try {
    const languages = headerLanguages(req.headers["accept-language"]);

    let match: Match<any> | null | undefined;
    const activeRoute = routes.find(
      route => (match = matchPath(req.path, route)),
    );

    const headers = setForwardedHeaders(req.headers);
    const auth = getJwtCookie(req.headers);

    const client = wrapClient(
      new LemmyHttp(getHttpBaseInternal(), { headers }),
    );

    const { path, url } = req;

    // Get site data first
    // This bypasses errors, so that the client can hit the error on its own,
    // in order to remove the jwt on the browser. Necessary for wrong jwts
    let siteRes: GetSiteResponse | undefined = undefined;
    let myUserInfo: MyUserInfo | undefined = undefined;
    let routeData: RouteData = {};
    let errorPageData: ErrorPageData | undefined = undefined;
    const trySite = await client.getSite();
    let tryUser = await client.getMyUser();

    if (tryUser.state === "failed" && tryUser.err.message === "not_logged_in") {
      console.error(
        "Incorrect JWT token, skipping auth so frontend can remove jwt cookie",
      );
      client.setHeaders({});
      tryUser = await client.getMyUser();
    }

    if (!auth && isAuthPath(path)) {
      return res.redirect(`/login${getQueryString({ prev: url })}`);
    }

    if (tryUser.state === "success") {
      myUserInfo = tryUser.data;
    }

    if (trySite.state === "success") {
      siteRes = trySite.data;

      if (path !== "/setup" && !siteRes.site_view.local_site.site_setup) {
        return res.redirect("/setup");
      }

      if (siteRes && activeRoute?.fetchInitialData && match) {
        const { search } = parsePath(url);
        const initialFetchReq: InitialFetchRequest<Record<string, any>> = {
          path,
          query: activeRoute.getQueryParams?.(search, siteRes) ?? {},
          match,
          site: siteRes,
          headers,
        };

        if (process.env.NODE_ENV === "development") {
          setTimeout(() => {
            // Intentionally (likely) break things if fetchInitialData tries to
            // use global state after the first await of an unresolved promise.
            // This simulates another request entering or leaving this
            // "success" block.
            myUserInfo = undefined;
            I18NextService.i18n.changeLanguage("cimode");
          });
        }
        routeData = await activeRoute.fetchInitialData(initialFetchReq);
      }

      if (!activeRoute) {
        res.status(404);
      }
    } else if (trySite.state === "failed") {
      res.status(500);
      errorPageData = getErrorPageData(new Error(trySite.err.message), siteRes);
    }

    const error = Object.values(routeData).find(
      res =>
        res.state === "failed" && res.err.message !== "couldnt_find_object", // TODO: find a better way of handling errors
    ) as FailedRequestState | undefined;

    // Redirect to the 404 if there's an API error
    if (error) {
      console.error(error.err);

      if (error.err.message === "instance_is_private") {
        return res.redirect(`/signup`);
      } else {
        res.status(500);
        errorPageData = getErrorPageData(new Error(error.err.message), siteRes);
      }
    }

    const isoData: IsoData = {
      path,
      siteRes: siteRes,
      myUserInfo,
      routeData,
      errorPageData,
      showAdultConsentModal:
        !!siteRes?.site_view.site.content_warning &&
        !(myUserInfo || req.cookies[adultConsentCookieKey]),
    };

    const wrapper = (
      <StaticRouter location={url} context={isoData}>
        <App />
      </StaticRouter>
    );

    setupMarkdown();
    LanguageService.updateLanguages(languages);

    const root = renderToString(wrapper);

    res.send(
      await createSsrHtml(
        root,
        isoData,
        res.locals.cspNonce,
        LanguageService.userLanguages(myUserInfo),
      ),
    );
  } catch (err) {
    // If an error is caught here, the error page couldn't even be rendered
    console.error(err);
    res.statusCode = 500;

    return res.send(
      process.env.NODE_ENV === "development" ? err.message : "Server error",
    );
  }
};

function headerLanguages(acceptLanguages?: string): string[] {
  return (
    acceptLanguages
      ?.split(",")
      .map(x => {
        const [head, tail] = x.split(/;\s*q?\s*=?/); // at ";", remove "q="
        const q = Number(tail ?? 1); // no q means q=1
        return { lang: head.trim(), q: Number.isNaN(q) ? 0 : q };
      })
      .filter(x => x.lang)
      .sort((a, b) => b.q - a.q)
      .map(x => (x.lang === "*" ? "en" : x.lang)) ?? []
  );
}
