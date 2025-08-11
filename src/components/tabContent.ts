// tabContent.ts
import { MarkdownView, Component } from "obsidian";

export class TabContent extends Component {
    public element: HTMLElement;
    public view: MarkdownView;
    public content: string;
    private isActive: boolean = false;
    private editorContainer: HTMLElement;
    private escapeHandler: (e: KeyboardEvent) => void;
    private clickHandler: (e: MouseEvent) => void;

    constructor(initialContent: string) {
        super();
        this.content = initialContent;

        this.element = document.createElement("div");
        this.element.className = "tab-content";

        // 创建编辑器容器
        this.editorContainer = document.createElement("div");
        this.editorContainer.className = "tab-editor-container";
        this.element.appendChild(this.editorContainer);

        // 创建事件处理器
        this.escapeHandler = this.handleEscape.bind(this);
        this.clickHandler = this.handleOutsideClick.bind(this);

        // 创建Markdown视图
        this.createView(this.editorContainer);

        // 设置初始内容并进入预览模式
        this.updateContent(initialContent);

        // 设置双击事件监听器
        this.setupDoubleClickHandler();
    }

    private createView(container: HTMLElement) {
        try {
            // @ts-ignore - 访问Obsidian内部API
            const embedCreator = app.embedRegistry.getEmbedCreator({ extension: "md" });

            // @ts-ignore - 创建Markdown视图
            this.view = embedCreator(
                {
                    app: app,
                    linktext: null,
                    sourcePath: null,
                    containerEl: container,
                    displayMode: false,
                    showInline: false,
                    depth: 0,
                },
                null
            ) as MarkdownView;

            this.addChild(this.view);

            // @ts-ignore - 启用编辑功能
            this.view.editable = true;

            // 添加全局点击监听器
            this.registerDomEvent(document, "click", this.clickHandler);

            this.enterEditMode();
            this.setContent(this.content);
            this.exitEditMode();
        } catch (error) {
            console.error("Failed to create Markdown view:", error);
            // 创建回退视图
            this.createFallbackView(container);
        }
    }

    private createFallbackView(container: HTMLElement) {
        container.innerHTML = `<div class="tab-error">Failed to load editor. Content: ${this.content}</div>`;
    }

    private setupDoubleClickHandler() {
        this.registerDomEvent(this.element, "dblclick", (e) => {
            if (this.isActive && !this.isEditing()) {
                this.enterEditMode();
            }
        });
    }

    private registerEscapeHandler() {
        if (this.view?.editor?.cm) {
            const editorEl = this.view.editor.cm.dom;
            this.registerDomEvent(editorEl, "keydown", this.escapeHandler);
        }
    }

    private handleEscape(e: KeyboardEvent) {
        if (e.key === "Escape") {
            // 阻止默认行为（Obsidian的ESC处理）
            e.stopPropagation();
            e.preventDefault();

            // 保存并退出编辑模式
            this.exitEditMode(true);
        }
    }

    private handleOutsideClick(e: MouseEvent) {
        if (!this.element.isConnected) document.removeEventListener("click", this.clickHandler);
        if (!this.isActive) return;
        // 检查点击是否发生在编辑器外部
        if (!this.editorContainer.contains(e.target as Node)) {
            this.exitEditMode(true);
        }
    }

    public enterEditMode() {
        try {
            // @ts-ignore - 显示编辑器
            this.view.showEditor();
            this.registerEscapeHandler();
        } catch (error) {
            console.error("Failed to enter edit mode:", error);
        }
    }

    public exitEditMode(saveContent: boolean = false) {
        try {
            // @ts-ignore - 显示预览
            this.view.showPreview();

            // 如果需要保存内容
            if (saveContent) {
                const newContent = this.getContent().trim();
                this.onContentSave(newContent);
            }
        } catch (error) {
            console.error("Failed to exit edit mode:", error);
        }
    }

    public isEditing(): boolean {
        return this.view.getMode() === "source";
    }

    public setActive(isActive: boolean) {
        this.isActive = isActive;

        if (isActive) {
            this.element.addClass("tab-content--active");
        } else {
            this.element.removeClass("tab-content--active");

            // 如果失去激活状态且正在编辑，则保存并返回预览模式
            if (this.isEditing()) {
                this.exitEditMode(true);
            }
        }
    }

    public updateContent(content: string) {
        this.content = content;

        if (this.view?.editor) {
            const currentContent = this.view.editor.getValue();

            // 仅当内容实际改变时才更新
            if (currentContent !== content) {
                this.setContent(content);
            }
        }
    }

    private setContent(content: string) {
        this.view.editor.setValue(content);
    }

    public getContent(): string {
        return this.view.data;
    }

    public onContentSave: (content: string) => void = () => {};

    public onunload() {
        this.element.remove();
        this.editorContainer.remove();
    }
}
