import mermaid from "mermaid";

export default function setupMermaid() {
    for (const codeBlock of document.querySelectorAll("#content pre code.language-mermaid")) {
        const parentPre = codeBlock.parentElement;
        if (!parentPre) {
            continue;
        }

        const mermaidDiv = document.createElement("div");
        mermaidDiv.classList.add("mermaid");
        mermaidDiv.innerHTML = codeBlock.innerHTML;
        parentPre.replaceWith(mermaidDiv);
    }

    mermaid.init();
}
