// tabBarItem.ts
import { TabContainer } from "./tabContainer";
import { TabData } from "./types";

export class TabBarItem {
    public element: HTMLElement;
    public isActive: boolean = false;
    private textElement: HTMLElement;
    private deleteButton: HTMLElement;
    private container: TabContainer;
    private index: number;

    constructor(container: TabContainer, tabData: TabData, index: number) {
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
        this.element.onclick = (e) => this.container.handleTabClick(e, this.index);
        this.element.ondblclick = (e) => this.container.handleTabDoubleClick(e, this.index);
        this.deleteButton.onclick = (e) => this.container.handleDeleteTab(e, this.index);

        this.element.ondragstart = (e) => this.container.handleDragStart(e, this.index);
        this.element.ondragover = (e) => this.container.handleDragOver(e, this.index);
        this.element.ondrop = (e) => this.container.handleDrop(e, this.index);
        this.element.ondragenter = (e) => this.container.handleDragEnter(e, this.index);
        this.element.ondragleave = (e) => this.container.handleDragLeave(e);
        this.element.ondragend = (e) => this.container.handleDragEnd(e);
    }

    public setActive(isActive: boolean) {
        this.isActive = isActive;
        if (isActive) {
            this.element.addClass("tab-item--active");
        } else {
            this.element.removeClass("tab-item--active");
        }
    }

    public updateText(text: string) {
        this.textElement.textContent = text;
    }

    public startEditing() {
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
}
