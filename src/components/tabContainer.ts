import { Component, MarkdownPostProcessorContext, MarkdownView, Notice } from "obsidian";
import { TabBarItem } from "./tabBarItem";
import { TabContent } from "./tabContent";
import { TabData } from "./types";
import Sortable from "sortablejs"; // 引入 Sortable

export class TabContainer extends Component {
    public tabs: TabData[] = [];
    public tabsElement: HTMLElement;
    public contentsElement: HTMLElement;
    public addButton: HTMLElement;
    private readonly id: string;
    private tabItems: TabBarItem[] = [];
    private contentItems: TabContent[] = [];
    private sortable: Sortable; // Sortable 实例

    // 每次修改内容会导致视图重新渲染，TabContainer会重新创建
    // 因此需要一个全局的Map来存储每个TabContainer的激活索引
    static activeIndexMap = new Map<string, { index: number; time: number }>();

    constructor(
        public containerEl: HTMLElement,
        public context: MarkdownPostProcessorContext,
        source: string
    ) {
        super();
        this.containerEl = containerEl;
        this.context = context;
        this.id = `${context.sourcePath}-${this.findSourcePosition().lineStart}`;
        this.parseSource(source);
        this.createStructure();
        this.setupEventHandlers();

        this.registerInterval(
            setInterval(() => {
                // 每分钟更新激活索引，给索引保个活
                TabContainer.getActiveIndex(this.id);
            }, 1000 * 60)
        );
    }

    static getActiveIndex(id: string): number {
        const activeIndex = this.activeIndexMap.get(id);
        if (!activeIndex) return 0;
        activeIndex.time = Date.now();
        return activeIndex.index;
    }

    static setActiveIndex(id: string, index: number) {
        this.activeIndexMap.set(id, { index, time: Date.now() });
    }

    private isExist(): boolean {
        return this.containerEl && this.containerEl.isConnected;
    }

    private parseSource(source: string) {
        const tabsArray = source.split("tab:");
        this.tabs = [];

        for (let i = 1; i < tabsArray.length; i++) {
            const tabContent = tabsArray[i];
            const firstNewline = tabContent.indexOf("\n");
            const tabName = tabContent.substring(0, firstNewline).trim();
            const content = tabContent.substring(firstNewline + 1).trim();

            this.tabs.push({ tabName, content });
        }
    }

    public findSourcePosition() {
        const sectionInfo = this.context.getSectionInfo(this.containerEl);
        if (!sectionInfo) return null;
        const { lineStart, text } = sectionInfo;
        const lines = text.split("\n");
        const backtickCount = lines[lineStart].length - 3;
        const lineEnd =
            lineStart +
            lines.slice(lineStart).findIndex((line) => line == "`".repeat(backtickCount));
        return { lineStart, lineEnd };
    }

    private createStructure() {
        this.containerEl.className = "tab-container";

        this.tabsElement = document.createElement("div");
        this.tabsElement.className = "tabs";

        this.contentsElement = document.createElement("div");
        this.contentsElement.className = "tab-contents";

        this.addButton = document.createElement("div");
        this.addButton.className = "tab-add-button";
        this.addButton.innerHTML = "+";
        this.addButton.style.opacity = "0";
        this.addButton.style.transition = "opacity 0.3s";

        this.containerEl.appendChild(this.tabsElement);
        this.containerEl.appendChild(this.contentsElement);
        this.tabsElement.appendChild(this.addButton);

        this.renderTabs();
    }

    public renderTabs() {
        // 清理现有组件
        this.tabItems.forEach((item) => this.removeChild(item));
        this.contentItems.forEach((item) => this.removeChild(item));
        this.tabItems = [];
        this.contentItems = [];

        // 创建新组件
        this.tabs.forEach((tab, index) => {
            const tabItem = new TabBarItem(this, tab, index);
            this.tabsElement.insertBefore(tabItem.element, this.addButton);
            this.tabItems.push(tabItem);
            this.addChild(tabItem);

            // 创建内容区域
            const contentItem = new TabContent(tab.content);

            // 设置内容保存回调
            contentItem.onContentSave = (newContent) => {
                if (this.tabs[index].content === newContent) return; // 如果内容没有变化则不更新
                this.tabs[index].content = newContent;
                this.updateMarkdownSource();
            };

            this.contentsElement.appendChild(contentItem.element);
            this.contentItems.push(contentItem);
            this.addChild(contentItem);
        });

        // 初始化或重新初始化 Sortable
        this.initSortable();

        // 设置初始激活状态
        let activeIndex = TabContainer.getActiveIndex(this.id);
        activeIndex = Math.min(activeIndex, this.tabs.length - 1);
        activeIndex = Math.max(activeIndex, 0);
        setTimeout(() => this.setActiveTab(activeIndex, "instant"), 0);
    }

    private initSortable() {
        // 销毁现有的 Sortable 实例
        this.sortable?.destroy();

        // 初始化 Sortable
        this.sortable = new Sortable(this.tabsElement, {
            animation: 150,
            delay: 75,
            handle: ".tab-item", // 指定可拖拽的部分
            filter: ".tab-add-button", // 排除添加按钮
            ghostClass: "tab-ghost", // 拖拽时的幽灵元素类名
            chosenClass: "tab-chosen", // 被选中的元素的类名
            dragClass: "tab-drag", // 拖拽过程中的样式
            onEnd: (evt) => this.handleSortableEnd(evt),
        });
    }

    private handleSortableEnd(evt: Sortable.SortableEvent) {
        if (evt.oldIndex === undefined || evt.newIndex === undefined) return;

        // 调整 tabs 数组的顺序
        const movedTab = this.tabs.splice(evt.oldIndex, 1)[0];
        this.tabs.splice(evt.newIndex, 0, movedTab);

        // 更新激活标签的索引
        const activeIndex = TabContainer.getActiveIndex(this.id);
        if (activeIndex === evt.oldIndex) {
            TabContainer.setActiveIndex(this.id, evt.newIndex);
        } else if (activeIndex > evt.oldIndex && activeIndex <= evt.newIndex) {
            TabContainer.setActiveIndex(this.id, activeIndex - 1);
        } else if (activeIndex < evt.oldIndex && activeIndex >= evt.newIndex) {
            TabContainer.setActiveIndex(this.id, activeIndex + 1);
        }

        // 重新渲染标签（更新索引）
        this.renderTabs();
        this.updateMarkdownSource();
    }

    private setupEventHandlers() {
        this.addButton.onclick = () => this.handleAddTab();

        this.tabsElement.onmouseenter = () => {
            this.addButton.style.opacity = "1";
        };

        this.tabsElement.onmouseleave = () => {
            this.addButton.style.opacity = "0";
        };
    }

    public handleTabClick(e: MouseEvent, clickedIndex: number) {
        e.stopPropagation();
        this.setActiveTab(clickedIndex);
    }

    private setActiveTab(index: number, behavior: ScrollBehavior = "smooth") {
        TabContainer.setActiveIndex(this.id, index);
        this.tabItems.forEach((item, i) => {
            item.setActive(i === index, behavior);
        });
        this.contentItems.forEach((item, i) => {
            item.setActive(i === index);
        });
    }

    public handleTabDoubleClick(e: MouseEvent, tabIndex: number) {
        e.stopPropagation();
        const tabItem = this.tabItems[tabIndex];
        const input = tabItem.startEditing();
        const currentText = this.tabs[tabIndex].tabName;

        const finishEdit = () => {
            const newValue = input.value.trim() || currentText;
            tabItem.updateText(newValue);
            this.tabs[tabIndex].tabName = newValue;
            this.updateMarkdownSource();
        };

        tabItem.registerDomEvent(input, "blur", () => finishEdit());
        tabItem.registerDomEvent(input, "keydown", (e) => {
            if (e.key === "Enter") {
                finishEdit();
            } else if (e.key === "Escape") {
                tabItem.updateText(currentText);
            }
        });
    }

    public handleDeleteTab(e: MouseEvent, tabIndex: number) {
        e.stopPropagation();

        if (this.tabs.length <= 1) {
            new Notice("至少需要保留一个标签");
            return;
        }

        // 删除数据
        this.tabs.splice(tabIndex, 1);
        this.renderTabs();
        this.updateMarkdownSource();
    }

    public handleAddTab() {
        const newTab: TabData = {
            tabName: "新标签",
            content: "内容",
        };

        this.tabs.push(newTab);
        TabContainer.setActiveIndex(this.id, this.tabs.length - 1);
        this.renderTabs();
        this.updateMarkdownSource();
    }

    public updateMarkdownSource() {
        if (!this.isExist()) return;

        let newSource = this.tabs.map((tab) => `tab:${tab.tabName}\n${tab.content}\n`).join("\n");

        // 最长反引号长度
        let maxBacktickCount = 0;
        newSource.split("\n").forEach((line) => {
            if (/^`+$/.test(line)) {
                const backtickCount = line.length;
                if (backtickCount > maxBacktickCount) {
                    maxBacktickCount = backtickCount;
                }
            }
        });
        maxBacktickCount = Math.max(maxBacktickCount + 1, 3);

        newSource = `${"`".repeat(maxBacktickCount)}tab\n${newSource}\n${"`".repeat(
            maxBacktickCount
        )}`;

        const view = app.workspace.getActiveViewOfType(MarkdownView);
        const { lineStart, lineEnd } = this.findSourcePosition();
        const mode = view.getMode();
        if (mode === "source") {
            const editor = view.editor;
            editor.replaceRange(
                newSource,
                { line: lineStart, ch: 0 },
                { line: lineEnd, ch: editor.getLine(lineEnd).length }
            );
        } else {
            this.updateMarkdownSourceInPreview(newSource, lineStart, lineEnd);
        }
    }

    private async updateMarkdownSourceInPreview(
        newSource: string,
        lineStart: number,
        lineEnd: number
    ) {
        const view = app.workspace.getActiveViewOfType(MarkdownView);
        const file = view.file;
        const fileContent = await app.vault.read(file);
        const lines = fileContent.split("\n");
        lines.splice(lineStart, lineEnd - lineStart + 1, ...newSource.split("\n"));
        const updatedContent = lines.join("\n");
        await app.vault.modify(file, updatedContent);
    }

    public onunload() {
        try {
            this.sortable?.destroy();
        } catch (e) {}
        this.containerEl = null;
    }
}
