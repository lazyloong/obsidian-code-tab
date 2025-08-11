import { Component } from "obsidian";
import { TabContainer } from "./tabContainer";
import { TabData } from "./types";

export class TabBarItem extends Component {
    public element: HTMLElement;
    public isActive: boolean = false;
    private textElement: HTMLElement;
    private deleteButton: HTMLElement;
    private container: TabContainer;
    private index: number;

    constructor(container: TabContainer, tabData: TabData, index: number) {
        super();
        this.container = container;
        this.index = index;

        this.element = document.createElement("div");
        this.element.className = "tab-item";
        this.element.draggable = true;

        this.textElement = document.createElement("span");
        this.textElement.className = "tab-text";
        this.textElement.textContent = tabData.tabName;

        this.deleteButton = document.createElement("span");
        this.deleteButton.className = "tab-delete-button";
        this.deleteButton.innerHTML = "×";
        this.deleteButton.title = "删除标签";

        this.element.appendChild(this.textElement);
        this.element.appendChild(this.deleteButton);

        this.setupEventHandlers();
    }

    private setupEventHandlers() {
        this.registerDomEvent(this.element, "click", (e) =>
            this.container.handleTabClick(e, this.index)
        );
        this.registerDomEvent(this.textElement, "dblclick", (e) =>
            this.container.handleTabDoubleClick(e, this.index)
        );
        this.registerDomEvent(this.deleteButton, "dblclick", (e) =>
            this.container.handleDeleteTab(e, this.index)
        );
    }

    public setActive(isActive: boolean, behavior: ScrollBehavior = "smooth") {
        this.isActive = isActive;
        if (this.element) this.element.classList.toggle("tab-item--active", isActive);
        if (this.isActive) {
            const containerEl = this.container.tabsElement;
            if (!containerEl || !this.element) return;

            // 获取标签项和容器的位置信息
            const tabRect = this.element.getBoundingClientRect();
            const containerRect = containerEl.getBoundingClientRect();

            // 计算标签在容器中的可见性
            const isFullyVisible =
                tabRect.left >= containerRect.left && tabRect.right <= containerRect.right;

            // 如果标签未完全可见，则滚动到中间位置
            if (!isFullyVisible) {
                // 计算目标滚动位置
                const tabCenter = tabRect.left + tabRect.width / 2;
                const containerCenter = containerRect.width / 2;
                const targetScroll =
                    containerEl.scrollLeft + (tabCenter - containerRect.left) - containerCenter;

                // 应用平滑滚动
                containerEl.scrollTo({
                    left: targetScroll,
                    behavior: behavior,
                });
            }
        }
    }

    public updateText(text: string) {
        this.textElement.textContent = text;
    }

    public startEditing(): HTMLInputElement {
        const currentText = this.textElement.textContent || "";
        const input = document.createElement("input");
        input.type = "text";
        input.value = currentText;
        input.className = "tab-edit-input";

        this.textElement.innerHTML = "";
        this.textElement.appendChild(input);
        input.focus();
        input.select();

        return input;
    }

    public onunload(): void {
        this.element.remove();
        this.textElement.remove();
        this.deleteButton.remove();
        this.element = null;
        this.textElement = null;
        this.deleteButton = null;
        super.unload();
    }
}
