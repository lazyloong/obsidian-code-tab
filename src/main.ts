import { Plugin } from "obsidian";
import { TabContainer } from "./components/tabContainer";

export default class CodeTabPlugin extends Plugin {
    async onload() {
        this.registerMarkdownCodeBlockProcessor("tab", (source, element, context) => {
            const id = context.docId;
            new TabContainer(element, context, id, source);
        });
    }
}
