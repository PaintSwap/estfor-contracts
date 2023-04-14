import {Skill} from "@paintswap/estfor-definitions/types";
import {ethers} from "ethers";
import {AvatarInfo} from "../utils";

export const avatarInfos: AvatarInfo[] = [
  {
    name: "Kittie Mage",
    description:
      "Kittie Mage is a wise and thoughtful mage, skilled in the Arcane arts. A researcher, she is always eager to learn more about the world of magic.",
    imageURI: "1.jpg",
    startSkills: [Skill.MAGIC, Skill.NONE],
  },
  {
    name: "Itchy Lizzy",
    description:
      "Itchy Lizzy is skilled in stealth and deception. She prefers to work alone but will team up with others if it serves her ultimate goal.",
    imageURI: "2.jpg",
    startSkills: [Skill.THIEVING, Skill.NONE],
  },
  {
    name: "Polar Ace",
    description:
      "Polar Ace is a resourceful bard who is skilled in music and performance. He is highly charismatic and always knows how to put on a good show.",
    imageURI: "3.jpg",
    startSkills: [Skill.MAGIC, Skill.DEFENCE],
  },
  {
    name: "King Lionel",
    description:
      "King Lionel is a powerful warrior who is skilled in swordplay and hand-to-hand combat. A natural leader, he inspires confidence in all those around him.",
    imageURI: "4.jpg",
    startSkills: [Skill.MELEE, Skill.NONE],
  },
  {
    name: "Raging Ears",
    description:
      "Raging Ears is a kind wizard skilled in the healing arts. She is a deeply spiritual person who always puts the needs of others before her own.",
    imageURI: "5.jpg",
    startSkills: [Skill.MAGIC, Skill.HEALTH],
  },
  {
    name: "Sleepless Piggy",
    description:
      "Sleepless Piggy is a brawny and powerful barbarian who is skilled in hard combat. He is quick to anger and fiercely protective of his friends and allies.",
    imageURI: "6.jpg",
    startSkills: [Skill.MELEE, Skill.DEFENCE],
  },
  {
    name: "Wolfgang Companion",
    description:
      "Wolfgang Companion is a fierce ranger, skilled in trapping as well as archery. With a strong sense of justice, she will always defend the weak and innocent.",
    imageURI: "7.jpg",
    startSkills: [Skill.RANGE, Skill.NONE],
  },
  {
    name: "Slaying Doggo",
    description:
      "Slaying Doggo is a proud, ambitious warrior who is skilled in close combat and magic. His unshakable sense of duty makes him a powerful ally in battle.",
    imageURI: "8.jpg",
    startSkills: [Skill.MELEE, Skill.MAGIC],
  },
];
