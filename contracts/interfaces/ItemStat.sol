// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

enum EquipPosition {
    HEAD,
    NECK,
    BODY,
    RIGHT_ARM,
    LEFT_ARM,
    LEGS,
    BOOTS,
    AUX,
    FOOD,
    ARROWS,
    RUNES
}

enum Attribute {
    NONE,
    ATTACK,
    DEFENCE
}

struct ItemStat {
    bool exists;
    bool canEquip;
    Attribute attribute;
    EquipPosition equipPosition;
    uint8 bonus;
}
