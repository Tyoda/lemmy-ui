import { setIsoData } from "@utils/app";
import { Component } from "inferno";
import { SuccessResponse } from "lemmy-js-client";
import { I18NextService } from "../../services";
import {
  EMPTY_REQUEST,
  HttpService,
  LOADING_REQUEST,
  RequestState,
} from "../../services/HttpService";
import { toast } from "@utils/app";
import { HtmlTags } from "../common/html-tags";
import { Spinner } from "../common/icon";
import { simpleScrollMixin } from "../mixins/scroll-mixin";
import { RouteComponentProps } from "inferno-router/dist/Route";
import { isBrowser } from "@utils/browser";

interface State {
  verifyRes: RequestState<SuccessResponse>;
}

@simpleScrollMixin
export class VerifyEmail extends Component<
  RouteComponentProps<Record<string, never>>,
  State
> {
  private isoData = setIsoData(this.context);

  state: State = {
    verifyRes: EMPTY_REQUEST,
  };

  constructor(props: any, context: any) {
    super(props, context);
  }

  async verify() {
    this.setState({
      verifyRes: LOADING_REQUEST,
    });

    this.setState({
      verifyRes: await HttpService.client.verifyEmail({
        token: this.props.match.params.token,
      }),
    });

    if (this.state.verifyRes.state === "success") {
      toast(I18NextService.i18n.t("email_verified"));
      this.props.history.push("/login");
    }
  }

  async componentWillMount() {
    if (isBrowser()) {
      await this.verify();
    }
  }

  get documentTitle(): string {
    return `${I18NextService.i18n.t("verify_email")} - ${
      this.isoData.siteRes?.site_view.site.name
    }`;
  }

  render() {
    return (
      <div className="verfy-email container-lg">
        <HtmlTags
          title={this.documentTitle}
          path={this.context.router.route.match.url}
        />
        <div className="row">
          <div className="col-12 col-lg-6 offset-lg-3 mb-4">
            <h1 className="h4 mb-4">{I18NextService.i18n.t("verify_email")}</h1>
            {this.state.verifyRes.state === "loading" && (
              <h5>
                <Spinner large />
              </h5>
            )}
          </div>
        </div>
      </div>
    );
  }
}
