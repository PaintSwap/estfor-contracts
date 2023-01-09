// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.17;

enum EquipPosition {
    HEAD,
    NECK,
    BODY,
    RIGHT_ARM,
    LEFT_ARM,
    LEGS,
    DUMMY,
    DUMMY1
}

enum Attribute {
    NONE,
    ATTACK,
    DEFENCE
}

struct ItemStat {
    Attribute attribute;
    EquipPosition equipPosition;
    uint16 weight;
    uint8 bonus;
}
