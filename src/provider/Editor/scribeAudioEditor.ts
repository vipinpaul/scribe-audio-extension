import * as vscode from "vscode";
import { storageKeys } from "../../types/storage";
import { getNonce } from "../../utils/getNonce";
import { readUsfm } from "./utils/readBook";
import { processTheChapter } from "./utils/processChapter";
import { ExttoEditorWebMsgTypes, IChapterdata } from "../../types/editor";

export class ScribeAudioEditor {
  private panel: vscode.WebviewPanel | undefined;
  private static readonly viewType = "scribeAudioEditor";
  private readonly globalState: vscode.Memento;
  private readonly currentBC: { bookId: string; chapter: number };
  private loadedUSFMBookContent: Record<string, any>;
  private currentChapterVerses: IChapterdata[] | undefined;
  private readonly projectDirectory: vscode.Uri;
  constructor(private readonly context: vscode.ExtensionContext) {
    // starting here
    this.globalState = context.workspaceState;
    this.currentBC = this.getGlobalState(storageKeys.currentBC);
    this.projectDirectory = this.getGlobalState(storageKeys.workspaceDirectory);
    this.loadedUSFMBookContent = this.getGlobalState(
      storageKeys.loadedUSFMContent
    );

    // parse if loadedUSFM have content
    if (
      this.loadedUSFMBookContent &&
      typeof this.loadedUSFMBookContent === "string"
    ) {
      this.loadedUSFMBookContent = JSON.parse(this.loadedUSFMBookContent);
    }

    console.log("project DIR", this.projectDirectory);

    console.log(
      "called Scribe Editor ============= 7777777777777777777777777777777",
      this.globalState
    );

    // Create and configure the webview panel
    this.panel = vscode.window.createWebviewPanel(
      ScribeAudioEditor.viewType,
      `${this.currentBC.bookId} - ${this.currentBC.chapter}`, // panel tab title
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
      }
    );

    // set UI here
    if (this.panel) {
      this.panel.webview.html = this.getHtmlForEditoPanel(this.panel.webview);
    }

    console.log("readData");
    this.readData(this.currentBC.bookId, this.currentBC.chapter).then(
      (value) => {
        this.currentChapterVerses = value;
        console.log(
          "currentChapterVerses",
          this.currentChapterVerses,
          "value",
          value
        );
        if (this.panel?.webview) {
          this.postMessage(this.panel?.webview, {
            type: ExttoEditorWebMsgTypes.ChapterData,
            data: this.currentChapterVerses,
          });
        }
      }
    );

    // Dispose of the panel when it is closed
    this.panel.onDidDispose(() => {
      this.panel = undefined;
    });
  }
  /**
   * Send Message or event from EDITOR to Webview
   */
  private postMessage(webview: vscode.Webview, message: any) {
    webview.postMessage(message);
  }

  /**
   * Read the chapter content (USFM and Audio)
   */
  private async readData(book: string, chapter: number) {
    console.log("inside read data");

    let versificationData;
    // read only once while changing book
    console.log(
      "LOaded status of book : ================>",
      !!this.loadedUSFMBookContent?.[book],
      book
    );

    const usfmData =
      this.loadedUSFMBookContent && this.loadedUSFMBookContent[book]
        ? this.loadedUSFMBookContent[book]
        : await readUsfm(book);
    console.log("usfmdata", usfmData);

    if (!usfmData) {
      const versification = this.getGlobalState(storageKeys.versification);
      console.log("versification", versification);

      const versificationJSON = JSON.parse(versification);
      versificationData = versificationJSON.maxVerses[book];
    } else {
      // store parsed data to resue
      if (!this.loadedUSFMBookContent?.[book]) {
        if (!this.loadedUSFMBookContent) {
          this.loadedUSFMBookContent = {};
        }
        this.loadedUSFMBookContent[book] = usfmData;
        console.log(
          "in SAVE AFTER PARSE 00000000000000000000000000000000000000000"
        );
      }
      this.updateGlobalState(
        storageKeys.loadedUSFMContent,
        JSON.stringify(this.loadedUSFMBookContent)
      );
      console.log(
        "in SAVE AFter load 000000011111111111111122222222222222222222233333333333333"
      );
    }

    const chapterData = await processTheChapter(
      book,
      chapter,
      usfmData,
      versificationData,
      this.projectDirectory
    );
    return chapterData;
  }

  // Method to update the global state
  public updateGlobalState(key: string, value: any) {
    this.globalState.update(key, value);
  }

  // Method to retrieve data from the global state
  public getGlobalState(key: string): any {
    return this.globalState.get(key);
  }

  // Method to dispose the panel
  public dispose() {
    if (this.panel) {
      this.panel.dispose();
      this.panel = undefined;
    }
  }

  /**
   * Function to get the html of the Webview
   */
  private getHtmlForEditoPanel(webview: vscode.Webview): string {
    // Local path to script and css for the webview
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this.context.extensionUri,
        "src",
        "webview",
        "ui",
        "dist",
        "AudioEditorView",
        "index.js"
      )
    );
    const styleVSCodeUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this.context.extensionUri,
        "src",
        "webview",
        "ui",
        "dist",
        "AudioEditorView",
        "index.css"
      )
    );

    // Use a nonce to whitelist which scripts can be run
    const nonce = getNonce();

    return /* html */ `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} blob:; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
            
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            
            <link href="${styleVSCodeUri}" rel="stylesheet" />
            
            <title>Scribe Audio Editor</title>
        </head>
        <body>
            <div id="root"></div>
            <script nonce="${nonce}" src="${scriptUri}"></script>
        </body>
        </html>
    `;
  }
}

export let scribeAudioEditorInstance: ScribeAudioEditor | undefined;

export async function initAudioEditor(context: vscode.ExtensionContext) {
  if (scribeAudioEditorInstance) {
    scribeAudioEditorInstance.dispose();
  }
  scribeAudioEditorInstance = new ScribeAudioEditor(context);
  return scribeAudioEditorInstance;
}
