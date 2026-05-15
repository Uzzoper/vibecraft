export type TranslationLocale = "en" | "ptBR";

export interface TranslationDict {
  [key: string]: string;
}

export const translations: Record<TranslationLocale, TranslationDict> = {
  en: {
    pageTitle: "VibeCraft",
    gameTitle: "VIBECRAFTLAND",
    version: "v0.0.1",
    footer: "Developed by Juan Antonio Peruzzo",
    deathScreen: "💀 YOU DIED",
    healthSeparator: " / ",
    cycleDay: "Day",
    cycleNight: "Night",
    cycleMinSuffix: "min until night",
    cycleMinSuffixNight: "min until day",
    instructionsDesktop:
      "Click to play<br><br>WASD: Move<br>Space: Jump<br>Left Click: Remove Block<br>Right Click: Place Block<br>Scroll/1-5: Select Block",
    instructionsMobile:
      "Click to play<br><br>Joystick: Move<br>Buttons: Jump/Break/Place<br>Rotate: Toggle Landscape",
    orientationOverlay: "🔄 Rotate device to landscape mode",
    rotateTooltip: "Toggle landscape",
    rotateLockedTooltip: "Unlock orientation",
    jumpTooltip: "Jump",
    breakTooltip: "Break block",
    placeTooltip: "Place block",
    portraitAlert: "Please rotate device to landscape mode to play.",
    blockGrass: "Grass",
    blockDirt: "Dirt",
    blockStone: "Stone",
    blockWood: "Wood",
    blockLeaves: "Leaves",
    blockWater: "Water",
  },
  ptBR: {
    pageTitle: "VibeCraft",
    gameTitle: "VIBECRAFTLAND",
    version: "v0.0.1",
    footer: "Desenvolvido por Juan Antonio Peruzzo",
    deathScreen: "💀 VOCÊ MORREU",
    healthSeparator: " / ",
    cycleDay: "Dia",
    cycleNight: "Noite",
    cycleMinSuffix: "min até a noite",
    cycleMinSuffixNight: "min até o dia",
    instructionsDesktop:
      "Clique para jogar<br><br>WASD: Mover<br>Espaço: Pular<br>Clique Esquerdo: Remover Bloco<br>Clique Direito: Colocar Bloco<br>Scroll/1-5: Selecionar Bloco",
    instructionsMobile:
      "Clique para jogar<br><br>Joystick: Mover<br>Botões: Pular/Quebrar/Colocar<br>Girar: Alternar Paisagem",
    orientationOverlay: "🔄 Gire o dispositivo para modo paisagem",
    rotateTooltip: "Alternar paisagem",
    rotateLockedTooltip: "Destravar orientação",
    jumpTooltip: "Pular",
    breakTooltip: "Quebrar bloco",
    placeTooltip: "Colocar bloco",
    portraitAlert: "Por favor, gire o dispositivo para modo paisagem para jogar.",
    blockGrass: "Grama",
    blockDirt: "Terra",
    blockStone: "Pedra",
    blockWood: "Madeira",
    blockLeaves: "Folhas",
    blockWater: "Água",
  },
};
