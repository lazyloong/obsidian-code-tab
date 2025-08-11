import { Plugin } from "obsidian";
import { TabContainer } from "./components/tabContainer";

export default class CodeTabPlugin extends Plugin {
    async onload() {
        this.registerMarkdownCodeBlockProcessor("tab", (source, element, context) => {
            context.addChild(new TabContainer(element, context, source));
        });

        this.addCommand({
            id: "create-tab",
            name: "创建标签组件",
            editorCallback: (editor, view) => {
                const defaultContent = "```tab\ntab:新标签\n内容\n```";
                const line = editor.getCursor().line;
                editor.replaceRange(defaultContent, { line, ch: 0 });
                editor.setCursor({ line: line + 1, ch: 0 });
            },
        });

        this.registerInterval(
            setInterval(() => {
                for (const id of TabContainer.activeIndexMap.keys()) {
                    const { index, time } = TabContainer.activeIndexMap.get(id)!;
                    if (Date.now() - time > 1000 * 60 * 5) {
                        TabContainer.activeIndexMap.delete(id);
                    }
                }
            }, 1000 * 60 * 5)
        );
    }
}
