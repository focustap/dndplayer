import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { Token, TokenInteraction } from "../../domain/types";

export function NpcInteractionModal({
  interaction,
  token,
  onClose,
  preview = false,
}: {
  interaction: TokenInteraction;
  token: Token;
  onClose(): void;
  preview?: boolean;
}) {
  const showDialogue = interaction.type === "DIALOGUE" || interaction.type === "BOTH";
  const showShop = interaction.type === "SHOP" || interaction.type === "BOTH";
  const name = interaction.displayName.trim() || token.displayName;
  const dialoguePages = useMemo(() => {
    const pages = interaction.dialoguePages?.map((page) => page.trim()).filter(Boolean) ?? [];
    if (pages.length) return pages;
    return interaction.dialogueText.trim() ? [interaction.dialogueText.trim()] : [""];
  }, [interaction.dialoguePages, interaction.dialogueText]);
  const [pageIndex, setPageIndex] = useState(0);

  useEffect(() => {
    setPageIndex(0);
  }, [interaction.tokenId, dialoguePages.length]);

  const page = dialoguePages[Math.min(pageIndex, dialoguePages.length - 1)] ?? "";

  return (
    <div
      className="npc-interaction-backdrop"
      role="button"
      tabIndex={0}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
        if (showDialogue && event.key === "ArrowRight" && pageIndex < dialoguePages.length - 1)
          setPageIndex((current) => current + 1);
        if (showDialogue && event.key === "ArrowLeft" && pageIndex > 0)
          setPageIndex((current) => current - 1);
      }}
    >
      <section
        className="npc-interaction-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`Interaction with ${name}`}
        onClick={(event) => event.stopPropagation()}
      >
        <button className="npc-interaction-close" onClick={onClose} aria-label="Close interaction">
          <X />
        </button>

        <div className="npc-interaction-portrait">
          {token.imageUrl ? (
            <img src={token.imageUrl} alt={name} />
          ) : (
            <div className="npc-interaction-fallback" aria-hidden="true">
              {name.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="npc-interaction-nameplate">
            <small>{preview ? "PREVIEW" : "INTERACT"}</small>
            <h2>{name}</h2>
          </div>
        </div>

        <div className="npc-interaction-content">
          {showDialogue && (
            <section className="npc-dialogue-panel">
              <div className="npc-dialogue-heading">
                <small>DIALOGUE</small>
                {dialoguePages.length > 1 && (
                  <span>{pageIndex + 1} / {dialoguePages.length}</span>
                )}
              </div>
              <p>{page || "…"}</p>
              {dialoguePages.length > 1 && (
                <div className="npc-dialogue-nav">
                  <button
                    type="button"
                    disabled={pageIndex === 0}
                    onClick={() => setPageIndex((current) => Math.max(0, current - 1))}
                  >
                    <ChevronLeft />
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={pageIndex >= dialoguePages.length - 1}
                    onClick={() => setPageIndex((current) => Math.min(dialoguePages.length - 1, current + 1))}
                  >
                    Next
                    <ChevronRight />
                  </button>
                </div>
              )}
            </section>
          )}

          {showShop && (
            <section className="npc-shop-panel">
              <header>
                <div>
                  <small>SHOP</small>
                  <h3>{showDialogue ? "Goods for sale" : name}</h3>
                </div>
                <span>{interaction.shopItems.length} item{interaction.shopItems.length === 1 ? "" : "s"}</span>
              </header>

              <div className="npc-shop">
                {interaction.shopItems.length ? (
                  interaction.shopItems.map((item) => (
                    <article key={item.id}>
                      <div className="npc-shop-item-title">
                        <b>{item.name}</b>
                        <span>{item.priceGp} gp</span>
                      </div>
                      {item.description && <p>{item.description}</p>}
                      {item.quantity !== null && (
                        <small>{item.quantity > 0 ? `${item.quantity} available` : "Sold out"}</small>
                      )}
                    </article>
                  ))
                ) : (
                  <p className="npc-shop-empty">Nothing is for sale right now.</p>
                )}
              </div>
            </section>
          )}
        </div>
      </section>
    </div>
  );
}
