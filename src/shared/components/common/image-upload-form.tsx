import { randomStr } from "@utils/helpers";
import classNames from "classnames";
import { Component, linkEvent } from "inferno";
import { HttpService, I18NextService } from "../../services";
import { toast } from "@utils/app";
import { Icon } from "./icon";
import { MyUserInfo } from "lemmy-js-client";

interface ImageUploadFormProps {
  uploadTitle: string;
  imageSrc?: string;
  onUpload(url: string): any;
  onRemove(): any;
  rounded?: boolean;
  myUserInfo?: MyUserInfo;
}

interface ImageUploadFormState {
  loading: boolean;
}

export class ImageUploadForm extends Component<
  ImageUploadFormProps,
  ImageUploadFormState
> {
  private id = `image-upload-form-${randomStr()}`;
  private emptyState: ImageUploadFormState = {
    loading: false,
  };

  constructor(props: any, context: any) {
    super(props, context);
    this.state = this.emptyState;
  }

  render() {
    return (
      <form className="image-upload-form d-inline">
        {this.props.imageSrc && (
          <span className="d-inline-block position-relative mb-2">
            {/* TODO: Create "Current Image" translation for alt text */}
            <img
              alt=""
              src={this.props.imageSrc}
              height={this.props.rounded ? 60 : ""}
              width={this.props.rounded ? 60 : ""}
              className={classNames({
                "rounded-circle object-fit-cover": this.props.rounded,
                "img-fluid": !this.props.rounded,
              })}
            />
            <button
              className="position-absolute d-block p-0 end-0 border-0 top-0 bg-transparent text-white"
              type="button"
              onClick={linkEvent(this, this.handleRemoveImage)}
              aria-label={I18NextService.i18n.t("remove")}
            >
              <Icon icon="x" classes="mini-overlay" />
            </button>
          </span>
        )}
        <input
          id={this.id}
          type="file"
          accept="image/*,video/*"
          className="small form-control"
          name={this.id}
          disabled={!this.props.myUserInfo}
          onChange={linkEvent(this, this.handleImageUpload)}
        />
      </form>
    );
  }

  handleImageUpload(i: ImageUploadForm, event: any) {
    event.preventDefault();
    const image = event.target.files[0] as File;

    i.setState({ loading: true });

    HttpService.client.uploadImage({ image }).then(res => {
      if (res.state === "success") {
        i.props.onUpload(res.data.image_url);
      } else if (res.state === "failed") {
        toast(res.err.message, "danger");
      }

      i.setState({ loading: false });
    });
  }

  handleRemoveImage(i: ImageUploadForm, event: any) {
    event.preventDefault();
    i.setState({ loading: true });
    i.props.onRemove();
  }
}
