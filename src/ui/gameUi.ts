import { t, setLocale, getLocale, subscribeLocaleChange } from "../i18n/i18n";
import type { DayNightState } from "../rendering/dayNight";

export interface GameUi {
  updateHud(playerHealth: number, playerMaxHealth: number): void;
  updateAllText(playerHealth: number | null, playerMaxHealth: number | null): void;
  setGameActive(active: boolean): void;
  updateInstructions(mobileEnabled: boolean): void;
  destroy(): void;
  healthBarBg: HTMLDivElement;
  healthText: HTMLDivElement;
  cycleIndicator: HTMLDivElement;
  deathOverlay: HTMLDivElement;
  title: HTMLDivElement;
  version: HTMLDivElement;
  instructions: HTMLDivElement;
  footer: HTMLDivElement;
  langToggle: HTMLButtonElement;
}

export function createGameUi(dayNight: DayNightState): GameUi {
  let lastMobileEnabled = false;

  const healthBarBg = document.createElement("div");
  healthBarBg.id = "health-bar-bg";
  document.body.appendChild(healthBarBg);

  const healthBar = document.createElement("div");
  healthBar.id = "health-bar";
  healthBarBg.appendChild(healthBar);

  const healthText = document.createElement("div");
  healthText.id = "health-text";
  healthText.textContent = `20 ${t("healthSeparator")} 20`;
  healthBarBg.appendChild(healthText);

  const cycleIndicator = document.createElement("div");
  cycleIndicator.id = "cycle-indicator";
  document.body.appendChild(cycleIndicator);

  const deathOverlay = document.createElement("div");
  deathOverlay.id = "death-overlay";
  deathOverlay.textContent = t("deathScreen");
  document.body.appendChild(deathOverlay);

  document.title = t("pageTitle");

  const title = document.createElement("div");
  title.id = "game-title";
  title.textContent = t("gameTitle");
  document.body.appendChild(title);

  const version = document.createElement("div");
  version.id = "game-version";
  version.textContent = t("version");
  document.body.appendChild(version);

  const instructions = document.createElement("div");
  instructions.id = "instructions";
  document.body.appendChild(instructions);

  const footer = document.createElement("div");
  footer.id = "game-footer";
  footer.textContent = t("footer");
  document.body.appendChild(footer);

  const langToggle = document.createElement("button");
  langToggle.id = "lang-toggle";
  langToggle.textContent = getLocale() === "en" ? "🇧🇷" : "🇺🇸";
  document.body.appendChild(langToggle);

  function updateInstructions(mobileEnabled: boolean): void {
    lastMobileEnabled = mobileEnabled;
    instructions.innerHTML = mobileEnabled ? t("instructionsMobile") : t("instructionsDesktop");
  }

  function updateHud(playerHealth: number, playerMaxHealth: number): void {
    const ratio = playerHealth / playerMaxHealth;
    healthBar.style.width = `${ratio * 100}%`;
    healthText.textContent = `${Math.max(0, Math.ceil(playerHealth))} ${t("healthSeparator")} ${playerMaxHealth}`;

    if (ratio > 0.5) {
      healthBar.style.backgroundColor = "#4caf50";
    } else if (ratio > 0.25) {
      healthBar.style.backgroundColor = "#ff9800";
    } else {
      healthBar.style.backgroundColor = "#f44336";
    }

    const minutesLeft = dayNight.getMinutesLeft();
    cycleIndicator.textContent = dayNight.isNight()
      ? `🌙 ${t("cycleNight")} - ${minutesLeft.toFixed(0)} ${t("cycleMinSuffixNight")}`
      : `☀️ ${t("cycleDay")} - ${minutesLeft.toFixed(0)} ${t("cycleMinSuffix")}`;
  }

  function updateAllText(playerHealth: number | null, playerMaxHealth: number | null): void {
    document.title = t("pageTitle");
    title.textContent = t("gameTitle");
    version.textContent = t("version");
    footer.textContent = t("footer");
    deathOverlay.textContent = t("deathScreen");
    if (playerHealth !== null && playerMaxHealth !== null) {
      healthText.textContent = `${Math.max(0, Math.ceil(playerHealth))} ${t("healthSeparator")} ${playerMaxHealth}`;
    }
    langToggle.textContent = getLocale() === "en" ? "🇧🇷" : "🇺🇸";
  }

  function setGameActive(active: boolean): void {
    if (active) {
      instructions.style.display = "none";
      title.style.display = "none";
      version.style.display = "none";
      healthBarBg.style.display = "block";
      cycleIndicator.style.display = "block";
      footer.style.display = "none";
      langToggle.style.display = "none";
    } else {
      instructions.style.display = "block";
      title.style.display = "block";
      version.style.display = "block";
      healthBarBg.style.display = "none";
      cycleIndicator.style.display = "none";
      footer.style.display = "block";
      langToggle.style.display = "block";
    }
  }

  function destroy(): void {
    healthBarBg.remove();
    cycleIndicator.remove();
    deathOverlay.remove();
    title.remove();
    version.remove();
    instructions.remove();
    footer.remove();
    langToggle.remove();
  }

  langToggle.addEventListener("click", () => {
    const newLocale = getLocale() === "en" ? "ptBR" : "en";
    setLocale(newLocale);
  });

  updateInstructions(false);

  const unsubscribeLocaleChange = subscribeLocaleChange(() => {
    updateAllText(null, null);
    updateInstructions(lastMobileEnabled);
  });

  return {
    updateHud,
    updateAllText,
    setGameActive,
    updateInstructions,
    destroy: () => {
      unsubscribeLocaleChange();
      destroy();
    },
    healthBarBg,
    healthText,
    cycleIndicator,
    deathOverlay,
    title,
    version,
    instructions,
    footer,
    langToggle,
  };
}
