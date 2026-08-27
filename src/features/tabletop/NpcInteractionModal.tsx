import { X } from "lucide-react";
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
              <small>DIALOGUE</small>
              <p>{interaction.dialogueText.trim() || "…"}</p>
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
