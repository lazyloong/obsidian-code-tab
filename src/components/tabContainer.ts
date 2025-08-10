import { MarkdownPostProcessorContext, MarkdownView, Notice } from "obsidian";
import { TabBarItem } from "./tabBarItem";
import { TabContent } from "./tabContent";
import { TabData } from "./types";

// 每次修改内容会导致视图重新渲染，TabContainer会重新创建
// 因此需要一个全局的Map来存储每个TabContainer的激活索引
const activeIndexMap = new Map<string, number>();

export class TabContainer {
    public tabs: TabData[] = [];
    public tabsElement: HTMLElement;
    public contentsElement: HTMLElement;
    public addButton: HTMLElement;
    public draggedIndex: number | null = null;
    public dropIndicator: HTMLElement;
    private tabItems: TabBarItem[] = [];
    private contentItems: TabContent[] = [];

    constructor(
        public element: HTMLElement,
        public context: MarkdownPostProcessorContext,
        private readonly id: string,
        source: string
    ) {
        this.element = element;
        this.context = context;
        this.parseSource(source);
        this.createStructure();
        this.setupEventHandlers();
        this.createDropIndicator();
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
        const sectionInfo = this.context.getSectionInfo(this.element);
        const { lineStart, lineEnd } = sectionInfo;
        return { lineStart, lineEnd };
    }

    private createDropIndicator() {
        this.dropIndicator = document.createElement("div");
        this.dropIndicator.className = "tab-drop-indicator";
        this.dropIndicator.style.display = "none";
        this.tabsElement?.appendChild(this.dropIndicator);
    }

    private createStructure() {
        this.element.className = "tab-container";

        this.tabsElement = document.createElement("div");
        this.tabsElement.className = "tabs";

        this.contentsElement = document.createElement("div");
        this.contentsElement.className = "tab-contents";

        this.addButton = document.createElement("div");
        this.addButton.className = "tab-add-button";
        this.addButton.innerHTML = "+";
        this.addButton.style.opacity = "0";
        this.addButton.style.transition = "opacity 0.3s";

        this.element.appendChild(this.tabsElement);
        this.element.appendChild(this.contentsElement);
        this.tabsElement.appendChild(this.addButton);

        this.renderTabs();
    }

    public renderTabs() {
        // 清理现有组件
        this.tabItems.forEach((item) => item.element.remove());
        this.contentItems.forEach((item) => {
            item.containerEl.remove();
            item.unload();
        });
        this.tabItems = [];
        this.contentItems = [];

        // 创建新组件
        this.tabs.forEach((tab, index) => {
            const tabItem = new TabBarItem(this, tab, index);
            this.tabsElement.insertBefore(tabItem.element, this.addButton);
            this.tabItems.push(tabItem);

            // 创建内容区域
            const contentItem = new TabContent(tab.content);

            // 设置内容保存回调（确保保存到源文件）
            contentItem.onContentSave = (newContent) => {
                if (this.tabs[index].content === newContent) return; // 如果内容没有变化则不更新{
                this.tabs[index].content = newContent;
                this.updateMarkdownSource();
            };

            this.contentsElement.appendChild(contentItem.containerEl);
            this.contentItems.push(contentItem);

            // 设置初始激活状态
            if (index === (activeIndexMap.get(this.id) ?? 0)) {
                tabItem.setActive(true);
                contentItem.setActive(true);
            }
        });
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

    private setActiveTab(index: number) {
        activeIndexMap.set(this.id, index);
        this.tabItems.forEach((item, i) => {
            item.setActive(i === index);
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

        input.onblur = finishEdit;
        input.onkeydown = (e) => {
            if (e.key === "Enter") {
                finishEdit();
            } else if (e.key === "Escape") {
                tabItem.updateText(currentText);
            }
        };
    }

    public handleDeleteTab(e: MouseEvent, tabIndex: number) {
        e.stopPropagation();

        if (this.tabs.length <= 1) {
            new Notice("至少需要保留一个标签");
            return;
        }

        // 记录当前激活状态
        const wasActive = this.tabItems[tabIndex].isActive;

        // 删除数据
        this.tabs.splice(tabIndex, 1);
        this.renderTabs();

        // 如果删除的是激活标签，激活新的标签
        if (wasActive) {
            const newActiveIndex = Math.min(tabIndex, this.tabs.length - 1);
            this.handleTabClick(new MouseEvent("click"), newActiveIndex);
        }

        this.updateMarkdownSource();
    }

    public handleDragStart(e: DragEvent, index: number) {
        this.draggedIndex = index;
        e.dataTransfer!.effectAllowed = "move";
        this.tabItems[index].element.addClass("tab-item--dragging");
    }

    public handleDragOver(e: DragEvent, index: number) {
        e.preventDefault();
        e.dataTransfer!.dropEffect = "move";

        if (this.draggedIndex === null) return;
        if (this.wouldMove(this.draggedIndex, index)) {
            this.showDropIndicator(index);
        } else {
            this.hideDropIndicator();
        }
    }

    public handleDragEnter(e: DragEvent, index: number) {
        e.preventDefault();
        if (this.draggedIndex === null) return;
        if (this.wouldMove(this.draggedIndex, index)) {
            this.showDropIndicator(index);
        } else {
            this.hideDropIndicator();
        }
    }

    public handleDragLeave(e: DragEvent) {
        const relatedTarget = e.relatedTarget as HTMLElement;
        if (!relatedTarget || !this.tabsElement.contains(relatedTarget)) {
            this.hideDropIndicator();
        }
    }

    public handleDragEnd(e: DragEvent) {
        this.tabItems.forEach((item) => item.element.removeClass("tab-item--dragging"));
        this.hideDropIndicator();
        this.draggedIndex = null;
    }

    public handleDrop(e: DragEvent, dropIndex: number) {
        e.preventDefault();

        if (this.draggedIndex === null) return;
        if (!this.wouldMove(this.draggedIndex, dropIndex)) {
            this.hideDropIndicator();
            return;
        }

        const draggedTab = this.tabs[this.draggedIndex];
        this.tabs.splice(this.draggedIndex, 1);
        this.tabs.splice(dropIndex, 0, draggedTab);

        const activeTabIndex = this.tabItems.findIndex((item) => item.isActive);
        if (activeTabIndex === this.draggedIndex) {
            activeIndexMap.set(this.id, dropIndex);
        } else if (activeTabIndex > this.draggedIndex && activeTabIndex <= dropIndex) {
            activeIndexMap.set(this.id, activeTabIndex - 1);
        } else if (activeTabIndex < this.draggedIndex && activeTabIndex >= dropIndex) {
            activeIndexMap.set(this.id, activeTabIndex + 1);
        }

        this.renderTabs();
        this.updateMarkdownSource();

        this.hideDropIndicator();
        this.draggedIndex = null;
    }

    private wouldMove(draggedIndex: number, targetIndex: number): boolean {
        return draggedIndex !== targetIndex;
    }

    private showDropIndicator(targetIndex: number) {
        if (!this.dropIndicator) return;
        const tabItems = this.tabsElement.querySelectorAll(".tab-item");
        const targetTab = tabItems[targetIndex] as HTMLElement;
        if (!targetTab) return;

        const tabRect = targetTab.getBoundingClientRect();
        const tabsRect = this.tabsElement.getBoundingClientRect();

        let indicatorLeft: number;
        if (this.draggedIndex !== null && targetIndex > this.draggedIndex) {
            indicatorLeft = tabRect.right - tabsRect.left;
        } else {
            indicatorLeft = tabRect.left - tabsRect.left;
        }

        this.dropIndicator.style.display = "block";
        this.dropIndicator.style.left = `${indicatorLeft}px`;
    }

    private hideDropIndicator() {
        if (this.dropIndicator) {
            this.dropIndicator.style.display = "none";
        }
    }

    public handleAddTab() {
        const newTab: TabData = {
            tabName: "新标签",
            content: "\n",
        };

        this.tabs.push(newTab);
        this.renderTabs();
        this.updateMarkdownSource();

        setTimeout(() => {
            const lastIndex = this.tabItems.length - 1;
            if (lastIndex >= 0) {
                this.tabItems[lastIndex].startEditing();
            }
        }, 100);
    }

    public updateMarkdownSource() {
        let newSource = this.tabs.map((tab) => `tab:${tab.tabName}\n${tab.content}\n`).join("\n");
        const view = app.workspace.getActiveViewOfType(MarkdownView);
        const { lineStart, lineEnd } = this.findSourcePosition();
        const mode = view.getMode();
        if (mode === "source") {
            const editor = view.editor;
            editor.replaceRange(
                newSource,
                { line: lineStart + 1, ch: 0 },
                { line: lineEnd, ch: 0 }
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
        lines.splice(lineStart + 1, lineEnd - lineStart - 1, ...newSource.split("\n"));
        const updatedContent = lines.join("\n");
        await app.vault.modify(file, updatedContent);
    }
}
