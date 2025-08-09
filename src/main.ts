import { MarkdownRenderer, Notice, Plugin, MarkdownPostProcessorContext } from "obsidian";
import { EditorView } from "@codemirror/view";

interface TabData {
    tabName: string;
    content: string;
}

class TabContainer {
    private element: HTMLElement;
    private context: MarkdownPostProcessorContext;
    private tabs: TabData[] = [];
    private tabsElement: HTMLElement;
    private contentsElement: HTMLElement;
    private addButton: HTMLElement;
    private draggedIndex: number | null = null;
    private dropIndicator: HTMLElement; // 拖拽落点指示器

    constructor(element: HTMLElement, context: MarkdownPostProcessorContext, source: string) {
        this.element = element;
        this.context = context;
        this.parseSource(source);
        this.createStructure();
        this.setupEventHandlers();
        this.createDropIndicator(); // 创建拖拽指示器
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

    private findSourcePosition() {
        const sectionInfo = this.context.getSectionInfo(this.element);
        const text = sectionInfo.text.split("\n");
        const sourceStart = text.slice(0, sectionInfo.lineStart + 1).join("\n").length + 1;
        const sourceEnd = text.slice(0, sectionInfo.lineEnd).join("\n").length + 1;
        return { sourceStart, sourceEnd };
    }

    private createDropIndicator() {
        this.dropIndicator = document.createElement("div");
        this.dropIndicator.className = "tab-drop-indicator";
        this.dropIndicator.style.display = "none";
        this.tabsElement?.appendChild(this.dropIndicator);
    }

    private createStructure() {
        this.element.className = "tab-container";

        // 创建标签栏
        this.tabsElement = document.createElement("div");
        this.tabsElement.className = "tabs";

        // 创建内容区
        this.contentsElement = document.createElement("div");
        this.contentsElement.className = "tab-contents";

        // 创建添加按钮
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

    private renderTabs() {
        // 清空现有标签
        const existingTabs = this.tabsElement.querySelectorAll(".tab-item");
        existingTabs.forEach((tab) => tab.remove());

        const existingContents = this.contentsElement.querySelectorAll(".tab-content");
        existingContents.forEach((content) => content.remove());

        // 渲染标签
        this.tabs.forEach((tab, index) => {
            this.createTabItem(tab, index);
            this.createTabContent(tab, index);
        });
    }

    private createTabItem(tab: TabData, index: number) {
        const tabItem = document.createElement("div");
        tabItem.className = "tab-item";
        tabItem.draggable = true;

        // 创建标签文本容器
        const tabText = document.createElement("span");
        tabText.className = "tab-text";
        tabText.textContent = tab.tabName;

        // 创建删除按钮
        const deleteButton = document.createElement("span");
        deleteButton.className = "tab-delete-button";
        deleteButton.innerHTML = "×";
        deleteButton.title = "删除标签";

        // 将文本和删除按钮添加到标签项
        tabItem.appendChild(tabText);
        tabItem.appendChild(deleteButton);

        if (index === 0) {
            tabItem.addClass("tab-item--active");
        }

        // 点击事件（仅在点击文本区域时触发）
        tabText.onclick = (e) => this.handleTabClick(e, index);

        // 双击编辑事件（仅在点击文本区域时触发）
        tabText.ondblclick = (e) => this.handleTabDoubleClick(e, index);

        // 删除按钮点击事件
        deleteButton.onclick = (e) => this.handleDeleteTab(e, index);

        // 拖拽事件
        tabItem.ondragstart = (e) => this.handleDragStart(e, index);
        tabItem.ondragover = (e) => this.handleDragOver(e, index);
        tabItem.ondrop = (e) => this.handleDrop(e, index);
        tabItem.ondragenter = (e) => this.handleDragEnter(e, index);
        tabItem.ondragleave = (e) => this.handleDragLeave(e);
        tabItem.ondragend = (e) => this.handleDragEnd(e);

        this.tabsElement.insertBefore(tabItem, this.addButton);
    }

    private createTabContent(tab: TabData, index: number) {
        const tabContent = document.createElement("div");
        tabContent.className = "tab-content";

        // 使用MarkdownRenderer渲染内容
        MarkdownRenderer.renderMarkdown(tab.content, tabContent, this.context.sourcePath);

        if (index === 0) {
            tabContent.addClass("tab-content--active");
        }

        this.contentsElement.appendChild(tabContent);
    }

    private setupEventHandlers() {
        // 添加按钮事件
        this.addButton.onclick = () => this.handleAddTab();

        // 鼠标悬停显示添加按钮
        this.tabsElement.onmouseenter = () => {
            this.addButton.style.opacity = "1";
        };

        this.tabsElement.onmouseleave = () => {
            this.addButton.style.opacity = "0";
        };
    }

    private handleTabClick(e: MouseEvent, clickedIndex: number) {
        e.stopPropagation();

        const tabItems = this.tabsElement.querySelectorAll(".tab-item");
        const tabContents = this.contentsElement.querySelectorAll(".tab-content");

        tabItems.forEach((item, index) => {
            if (index === clickedIndex) {
                item.addClass("tab-item--active");
                tabContents[index]?.addClass("tab-content--active");
            } else {
                item.removeClass("tab-item--active");
                tabContents[index]?.removeClass("tab-content--active");
            }
        });
    }

    private handleTabDoubleClick(e: MouseEvent, tabIndex: number) {
        e.stopPropagation();
        const tabText = e.target as HTMLElement;
        const currentText = tabText.textContent || "";

        // 创建输入框
        const input = document.createElement("input");
        input.type = "text";
        input.value = currentText;
        input.className = "tab-edit-input";

        // 替换标签文本内容
        tabText.innerHTML = "";
        tabText.appendChild(input);
        input.focus();
        input.select();

        // 完成编辑
        const finishEdit = () => {
            const newValue = input.value.trim() || currentText;
            tabText.textContent = newValue;

            // 更新数据
            this.tabs[tabIndex].tabName = newValue;
            this.updateMarkdownSource();
        };

        // 事件监听
        input.onblur = finishEdit;
        input.onkeydown = (e) => {
            if (e.key === "Enter") {
                finishEdit();
            } else if (e.key === "Escape") {
                tabText.textContent = currentText;
            }
        };
    }

    private handleDeleteTab(e: MouseEvent, tabIndex: number) {
        e.stopPropagation();

        // 如果只有一个标签，不允许删除
        if (this.tabs.length <= 1) {
            new Notice("至少需要保留一个标签");
            return;
        }

        // 删除标签数据
        this.tabs.splice(tabIndex, 1);

        // 如果删除的是当前激活的标签，需要激活相邻的标签
        const tabItems = this.tabsElement.querySelectorAll(".tab-item");
        const isActiveTab = tabItems[tabIndex]?.hasClass("tab-item--active");

        // 重新渲染
        this.renderTabs();

        // 如果删除的是激活标签，激活新的标签
        if (isActiveTab) {
            const newActiveIndex = Math.min(tabIndex, this.tabs.length - 1);
            this.handleTabClick(new MouseEvent("click"), newActiveIndex);
        }

        // 更新markdown源码
        this.updateMarkdownSource();
    }

    private handleDragStart(e: DragEvent, index: number) {
        this.draggedIndex = index;
        e.dataTransfer!.effectAllowed = "move";

        // 添加拖拽时的视觉效果
        const tabItem = e.target as HTMLElement;
        tabItem.addClass("tab-item--dragging");
    }

    private handleDragOver(e: DragEvent, index: number) {
        e.preventDefault();
        e.dataTransfer!.dropEffect = "move";

        if (this.draggedIndex === null) {
            return;
        }

        // 检查是否会发生实际移动
        if (this.wouldMove(this.draggedIndex, index)) {
            this.showDropIndicator(index);
        } else {
            this.hideDropIndicator();
        }
    }

    private handleDragEnter(e: DragEvent, index: number) {
        e.preventDefault();

        if (this.draggedIndex === null) {
            return;
        }

        // 检查是否会发生实际移动
        if (this.wouldMove(this.draggedIndex, index)) {
            this.showDropIndicator(index);
        } else {
            this.hideDropIndicator();
        }
    }

    private handleDragLeave(e: DragEvent) {
        // 检查是否真的离开了标签区域
        const relatedTarget = e.relatedTarget as HTMLElement;
        if (!relatedTarget || !this.tabsElement.contains(relatedTarget)) {
            this.hideDropIndicator();
        }
    }

    private handleDragEnd(e: DragEvent) {
        // 清理拖拽状态
        const tabItems = this.tabsElement.querySelectorAll(".tab-item");
        tabItems.forEach((item) => item.removeClass("tab-item--dragging"));
        this.hideDropIndicator();
        this.draggedIndex = null;
    }

    private handleDrop(e: DragEvent, dropIndex: number) {
        e.preventDefault();

        if (this.draggedIndex === null) {
            return;
        }

        // 检查是否会发生实际移动
        if (!this.wouldMove(this.draggedIndex, dropIndex)) {
            this.hideDropIndicator();
            return;
        }

        // 重新排序标签数据
        const draggedTab = this.tabs[this.draggedIndex];
        this.tabs.splice(this.draggedIndex, 1);
        this.tabs.splice(dropIndex, 0, draggedTab);

        // 重新渲染
        this.renderTabs();

        // 更新markdown源码
        this.updateMarkdownSource();

        this.hideDropIndicator();
        this.draggedIndex = null;
    }

    private wouldMove(draggedIndex: number, targetIndex: number): boolean {
        // 检查拖拽是否会导致实际的位置变化
        if (draggedIndex === targetIndex) {
            return false;
        }

        // 如果拖拽到相邻位置，检查是否真的会移动
        if (Math.abs(draggedIndex - targetIndex) === 1) {
            // 相邻元素的拖拽只有在特定条件下才会移动
            // 这里可以根据具体需求调整逻辑
            return true;
        }

        return true;
    }

    private showDropIndicator(targetIndex: number) {
        if (!this.dropIndicator) return;

        const tabItems = this.tabsElement.querySelectorAll(".tab-item");
        const targetTab = tabItems[targetIndex] as HTMLElement;

        if (!targetTab) return;

        const tabRect = targetTab.getBoundingClientRect();
        const tabsRect = this.tabsElement.getBoundingClientRect();

        // 计算指示器位置
        let indicatorLeft: number;

        if (this.draggedIndex !== null && targetIndex > this.draggedIndex) {
            // 向右拖拽，指示器显示在目标标签右侧
            indicatorLeft = tabRect.right - tabsRect.left;
        } else {
            // 向左拖拽，指示器显示在目标标签左侧
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

    private handleAddTab() {
        const newTab: TabData = {
            tabName: "新标签",
            content: "\n",
        };

        this.tabs.push(newTab);
        this.renderTabs();
        this.updateMarkdownSource();

        // 自动进入编辑模式
        setTimeout(() => {
            const lastTabItem = this.tabsElement.querySelectorAll(".tab-text");
            const lastTab = lastTabItem[lastTabItem.length - 1] as HTMLElement;
            if (lastTab) {
                lastTab.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
            }
        }, 100);
    }

    private updateMarkdownSource() {
        // 构建新的markdown源码
        let newSource = this.tabs.map((tab) => `tab:${tab.tabName}\n${tab.content}\n`).join("\n");

        // 获取编辑器视图
        const view = this.getEditorView();
        if (view) {
            console.log("新的源码内容:", newSource);
            const { sourceStart, sourceEnd } = this.findSourcePosition();
            const transaction = view.state.update({
                changes: { from: sourceStart, to: sourceEnd, insert: newSource },
            });
            view.dispatch(transaction);
        }
    }

    private getEditorView(): EditorView | null {
        // 获取当前活动的编辑器视图
        // 这需要访问Obsidian的编辑器API
        const activeLeaf = (app as any).workspace.activeLeaf;
        if (activeLeaf?.view?.editor?.cm) {
            return activeLeaf.view.editor.cm;
        }
        return null;
    }
}

export default class CodeTabPlugin extends Plugin {
    async onload() {
        this.registerMarkdownCodeBlockProcessor("tab", (source, element, context) => {
            console.log(context, context.getSectionInfo(element));
            new TabContainer(element, context, source);
        });

        // 添加样式
        this.addStyle();
    }

    private addStyle() {
        const style = document.createElement("style");
        style.textContent = `
            .tab-container {
                border: 1px solid var(--background-modifier-border);
                border-radius: 8px;
                overflow: hidden;
                margin: 1em 0;
            }
            
            .tabs {
                display: flex;
                background-color: var(--background-secondary);
                border-bottom: 1px solid var(--background-modifier-border);
                position: relative;
                overflow: hidden;
            }
            
            .tab-item {
                padding: 8px 12px;
                cursor: pointer;
                border-right: 1px solid var(--background-modifier-border);
                background-color: var(--background-secondary);
                transition: all 0.2s ease;
                user-select: none;
                position: relative;
                display: flex;
                align-items: center;
                justify-content: center;
                min-width: fit-content;
            }
            
            .tab-item:hover {
                background-color: var(--background-modifier-hover);
            }
            
            .tab-item--active {
                background-color: var(--background-primary);
                color: var(--text-accent);
            }
            
            .tab-item--dragging {
                opacity: 0.5;
                transform: rotate(2deg);
                z-index: 1000;
            }
            
            .tab-text {
                pointer-events: all;
                text-align: center;
                position: relative;
                z-index: 1;
            }
            
            .tab-delete-button {
                opacity: 0;
                color: var(--text-muted);
                font-size: 16px;
                font-weight: bold;
                width: 0;
                height: 16px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 3px;
                transition: all 0.2s ease;
                line-height: 1;
                cursor: pointer;
                margin-left: 0;
                flex-shrink: 0;
                overflow: hidden;
                transform: scale(0);
                position: absolute;
                right: 8px;
                top: 50%;
                transform-origin: center;
                transform: translateY(-50%) scale(0);
            }
            
            .tab-item:hover {
                padding-right: 28px;
            }
            
            .tab-item:hover .tab-delete-button {
                opacity: 1;
                width: 16px;
                transform: translateY(-50%) scale(1);
            }
            
            .tab-delete-button:hover {
                background-color: var(--background-modifier-error);
                color: var(--text-on-accent);
                transform: scale(1.1);
            }
            
            .tab-content {
                display: none;
                padding: 16px;
                background-color: var(--background-primary);
            }
            
            .tab-content--active {
                display: block;
            }
            
            .tab-add-button {
                padding: 8px 12px;
                cursor: pointer;
                background-color: var(--background-secondary);
                color: var(--text-muted);
                font-weight: bold;
                margin-left: auto;
                border-left: 1px solid var(--background-modifier-border);
            }
            
            .tab-add-button:hover {
                background-color: var(--background-modifier-hover);
                color: var(--text-normal);
            }
            
            .tab-edit-input {
                background: transparent;
                border: 1px solid var(--text-accent);
                color: var(--text-normal);
                padding: 2px 4px;
                font-size: inherit;
                font-family: inherit;
                width: 100px;
            }
            
            .tab-drop-indicator {
                position: absolute;
                top: 0;
                bottom: 0;
                width: 3px;
                height: 100%;
                background-color: var(--text-accent);
                z-index: 1001;
                border-radius: 1px;
                box-shadow: 0 0 8px var(--text-accent);
                animation: pulse 0.8s infinite ease-in-out;
                transform: translateX(-1px);
            }
            
            @keyframes pulse {
                0%, 100% {
                    opacity: 0.6;
                    transform: translateX(-1px) scale(1);
                }
                50% {
                    opacity: 1;
                    transform: translateX(-1px) scale(1.2);
                }
            }
        `;
        document.head.appendChild(style);
    }
}
