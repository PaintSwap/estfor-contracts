import {AbiCoder, toBeHex} from "ethers"
import {EstforConstants as C} from "@paintswap/estfor-definitions"
import type {DeploymentRegistry, ContractName} from "./deploymentRegistry"
import type {
  GameDataAdapter,
  GameDataContext,
  GameDataRecord,
  GameDataValue,
  GameDataSnapshot,
} from "./gameDataReconciliation"
import {allItems} from "./data/items"
import {allQuests, allQuestsMinRequirements} from "./data/quests"
import {allActions} from "./data/actions"
import * as choiceData from "./data/actionChoices"
import * as choiceIds from "./data/actionChoiceIds"
import {cosmeticInfos, cosmeticTokenIds} from "./data/cosmetics"
import {allInstantActions} from "./data/instantActions"
import {allInstantVRFActions} from "./data/instantVRFActions"
import {loadContractInterface} from "./deploymentArtifacts"
import {allPassiveActions} from "./data/passiveActions"
import {allBasePets} from "./data/pets"
import {allXPThresholdRewards} from "./data/xpThresholdRewards"
import {allFullAttireBonuses} from "./data/fullAttireBonuses"
import {avatarIds, avatarInfos} from "./data/avatars"
import {allDailyRewards, allWeeklyRewards} from "./data/dailyRewards"
import {allOrderBookTokenIdInfos} from "./data/orderbookTokenIdInfos"
import {allClanTiers, allClanTiersBeta} from "./data/clans"
import {allBattleSkills, allTerritories, allMinimumMMRs} from "./data/territories"
import {allBaseRaidIds, allBaseRaids, raidCombatActionIds} from "./data/raids"
import {subsidyGroups} from "./data/groupSubsidyLimits"

const settlementNote =
  "Configuration edits affect pending/unprocessed gameplay just like existing owner edits; they do not reset runtime state."
const row = (key: unknown, value: GameDataValue): GameDataRecord => ({key: String(key), value})
const call = (fn: string, ...args: unknown[]) => ({fn, args})
const complete = (records: GameDataRecord[]): GameDataSnapshot => ({records, completeness: "complete"})
const flags = (value: GameDataValue, extra = 0) =>
  toBeHex((value.isFullModeOnly ? 128 : 0) | (value.isAvailable ? 64 : 0) | extra, 1)

function slots(value: GameDataValue, arrays: Record<string, string>, count = 3): GameDataValue {
  const result = {...value}
  for (const [source, target] of Object.entries(arrays)) {
    for (let i = 0; i < count; i++) result[`${target}${i + 1}`] = value[source]?.[i] ?? 0
  }
  return result
}

function rewards(input: GameDataValue): GameDataValue {
  const result: GameDataValue = {}
  for (let i = 0; i < 3; i++) {
    result[`guaranteedRewardTokenId${i + 1}`] = input.guaranteedRewards[i]?.itemTokenId ?? 0
    result[`guaranteedRewardRate${i + 1}`] = input.guaranteedRewards[i]?.rate ?? 0
  }
  for (let i = 0; i < 4; i++) {
    result[`randomRewardTokenId${i + 1}`] = input.randomRewards[i]?.itemTokenId ?? 0
    result[`randomRewardChance${i + 1}`] = input.randomRewards[i]?.chance ?? 0
    result[`randomRewardAmount${i + 1}`] = input.randomRewards[i]?.amount ?? 0
  }
  return result
}

async function discoveryStatus(ctx: GameDataContext): Promise<GameDataSnapshot["completeness"]> {
  const status = Number(await ctx.call("discoveryStatus"))
  if (status > 2) throw new Error(`Unknown discovery status ${status}`)
  return ["incomplete", "complete", "legacy-attested"][status] as GameDataSnapshot["completeness"]
}

// A bounded-key domain with direct getters and batch add/edit/remove functions.
function keyed(
  domain: string,
  contract: ContractName,
  inputs: GameDataValue[],
  key: string,
  getters: Record<string, (input: GameDataValue) => unknown>,
  discover: (ctx: GameDataContext) => Promise<string[]>,
  add: string,
  edit: string,
  remove?: string,
  validate?: (input: GameDataValue, current: GameDataRecord) => void
): GameDataAdapter {
  const byKey = new Map(inputs.map((input) => [String(input[key]), input]))
  return {
    domain,
    contract,
    notes: [settlementNote],
    desired: (ctx) =>
      inputs.map((input) =>
        row(
          input[key],
          Object.fromEntries(
            Object.entries(getters).map(([getter, project]) => [getter, ctx.value(getter, project(input))])
          )
        )
      ),
    async read(ctx) {
      const records: GameDataRecord[] = []
      for (const id of await discover(ctx)) {
        const value: GameDataValue = {}
        for (const getter of Object.keys(getters)) value[getter] = ctx.value(getter, await ctx.call(getter, [id]))
        records.push(row(id, value))
      }
      return complete(records)
    },
    write(action, id, current) {
      if (action === "remove") {
        if (!remove) throw new Error("Removal is unsafe: existing gameplay references this definition")
        return [call(remove, [id])]
      }
      const input = byKey.get(id)!
      if (current) validate?.(input, current)
      return [call(action === "add" ? add : edit, [input])]
    },
  }
}

export function gameDataAdapters(deployment: DeploymentRegistry): GameDataAdapter[] {
  const adapters: GameDataAdapter[] = []
  const subsidies = subsidyGroups(deployment)
  const selectors = new Map<string, string>(
    subsidies.flatMap((group) =>
      group.selectors.map(
        (entry) => [`${entry.contract.toLowerCase()}:${entry.selector.toLowerCase()}`, String(entry.groupId)] as const
      )
    )
  )
  adapters.push(
    {
      domain: "session-subsidy-selectors",
      contract: "gameSubsidisationRegistry",
      desired: () => [...selectors].map(([key, group]) => row(key, {group})),
      async read(ctx) {
        const completeness = await discoveryStatus(ctx)
        const keys = new Set(selectors.keys())
        const count: bigint = await ctx.call("getSubsidisedFunctionCount")
        for (let start = 0n; start < count; start += 1024n) {
          const [addresses, functions] = await ctx.call("getSubsidisedFunctions", [
            start,
            start + 1024n < count ? start + 1024n : count,
          ])
          addresses.forEach((address: string, i: number) =>
            keys.add(`${address.toLowerCase()}:${functions[i].toLowerCase()}`)
          )
        }
        const records = []
        for (const key of keys) {
          const group = String(await ctx.call("functionToLimitGroup", key.split(":")))
          if (group !== "0") records.push(row(key, {group}))
        }
        return {records, completeness}
      },
      write: (action, key) => [
        call("setFunctionGroup", ...key.split(":"), action === "remove" ? 0 : selectors.get(key)),
      ],
    },
    {
      domain: "session-subsidy-limits",
      contract: "gameSubsidisationRegistry",
      desired: () =>
        subsidies.map((group) =>
          row(group.groupId, {limit: String(group.limit * (deployment.profile === "beta" ? 10 : 1))})
        ),
      async read(ctx) {
        const records = []
        for (const group of subsidies)
          records.push(row(group.groupId, {limit: String(await ctx.call("groupDailyLimits", [group.groupId]))}))
        return {
          records,
          completeness: "incomplete",
          notes: [
            "Independent historical group-limit keys are not enumerable; only canonical group limits are managed.",
          ],
        }
      },
      write(action, key) {
        if (action === "remove") throw new Error("Unknown historical group limits cannot be removed safely")
        const group = subsidies.find((group) => String(group.groupId) === key)!
        return [call("setGroupLimit", key, group.limit * (deployment.profile === "beta" ? 10 : 1))]
      },
    },
    {
      domain: "raid-combat-actions",
      contract: "raids",
      notes: ["Replacement affects pending spawns; existing raids retain their snapshotted action IDs."],
      desired: () => [row("pool", {ids: raidCombatActionIds.map(String)})],
      read: async (ctx) => complete([row("pool", {ids: (await ctx.call("getCombatActionIds")).map(String)})]),
      write: (_action, _key, current) => [
        {
          ...call("setCombatActions", raidCombatActionIds),
          destructive: current?.value.ids.some((id: string) => !raidCombatActionIds.map(String).includes(id)),
        },
      ],
    }
  )
  adapters.push(
    keyed(
      "items",
      "itemNFT",
      allItems,
      "tokenId",
      {
        getItem: (input) => ({...input, ...input.combatStats, packedData: flags(input, 1)}),
        getTokenURI: (input) => input.metadataURI,
      },
      (ctx) => ctx.scan("getItemTokenIds", 65536),
      "addItems",
      "editItems",
      "removeItems",
      (input, current) => {
        const before = current.value.getItem
        if (
          (input.healthRestored === 0 && before.healthRestored !== "0") ||
          (input.boostType === 0 && before.boostType !== "0")
        ) {
          throw new Error("Existing item setter cannot clear food/boost fields; remove/re-add is not used as a bypass")
        }
      }
    )
  )

  const questById = new Map(
    allQuests.map((quest, i) => [String(quest.questId), {quest, requirements: allQuestsMinRequirements[i]}])
  )
  adapters.push({
    domain: "quests",
    contract: "quests",
    notes: [settlementNote],
    desired: (ctx) =>
      [...questById].map(([id, {quest, requirements}]) =>
        row(id, {
          quest: ctx.value("allFixedQuests", {...quest, packedData: flags({...quest, isAvailable: false})}),
          requirements: ctx.value("getMinimumRequirements", requirements),
        })
      ),
    async read(ctx) {
      const records = []
      for (const id of await ctx.scan("getQuestIds", 65536))
        records.push(
          row(id, {
            quest: ctx.value("allFixedQuests", await ctx.call("allFixedQuests", [id])),
            requirements: ctx.value("getMinimumRequirements", await ctx.call("getMinimumRequirements", [id])),
          })
        )
      return complete(records)
    },
    write(action, id, current) {
      if (action === "remove") return [call("removeQuest", id)]
      const {quest, requirements} = questById.get(id)!
      if (current && current.value.quest.packedData !== flags({...quest, isAvailable: false})) {
        throw new Error("Quest full-mode status is immutable")
      }
      // Editing after add also clears hidden requirements left by an earlier removal.
      const update = call("editQuests", [quest], [requirements])
      return action === "add" ? [call("addQuests", [quest], [requirements]), update] : [update]
    },
  })

  adapters.push(
    keyed(
      "world-actions",
      "worldActions",
      allActions,
      "actionId",
      {
        getAction: (input) => input.info,
        getActionRewards: rewards,
        getCombatStats: (input) => input.combatStats,
      },
      (ctx) => ctx.scan("getActionIds", 65536),
      "addActions",
      "editActions"
    )
  )

  const groups: Array<[number, string]> = [
    [C.ACTION_FIREMAKING_ITEM, "Firemaking"],
    [C.ACTION_SMITHING_ITEM, "Smithing"],
    [C.ACTION_COOKING_ITEM, "Cooking"],
    [C.ACTION_CRAFTING_ITEM, "Crafting"],
    [C.ACTION_FLETCHING_ITEM, "Fletching"],
    [C.ACTION_ALCHEMY_ITEM, "Alchemy"],
    [C.ACTION_FORGING_ITEM, "Forging"],
    [C.ACTION_FARMING_ITEM, "Farming"],
    [0, "Melee"],
    [0, "Ranged"],
    [0, "Magic"],
  ]
  const choices = new Map<string, GameDataValue>()
  for (const [actionId, suffix] of groups) {
    const ids: number[] = (choiceIds as GameDataValue)[`allActionChoiceIds${suffix}`]
    const inputs: GameDataValue[] = (choiceData as GameDataValue)[`allActionChoices${suffix}`]
    ids.forEach((id, i) => choices.set(`${actionId}:${id}`, inputs[i]))
  }
  adapters.push({
    domain: "world-action-choices",
    contract: "worldActions",
    notes: [settlementNote],
    desired: (ctx) =>
      [...choices].map(([key, input]) =>
        row(key, {
          choice: ctx.value("getActionChoice", {
            ...slots(input, {
              inputTokenIds: "inputTokenId",
              inputAmounts: "inputAmount",
              skills: "skill",
              skillMinXPs: "skillMinXP",
              skillDiffs: "skillDiff",
            }),
            packedData: flags(input),
          }),
        })
      ),
    async read(ctx) {
      const actions = new Set(["0", ...(await ctx.scan("getActionIds", 65536)), ...groups.map(([id]) => String(id))])
      const records = []
      for (const action of actions) {
        for (const id of await ctx.scan("getActionChoiceIds", 65536, [action])) {
          records.push(
            row(`${action}:${id}`, {
              choice: ctx.value("getActionChoice", await ctx.call("getActionChoice", [action, id])),
            })
          )
        }
      }
      // Choices can be installed under arbitrary absent parent IDs; this scan covers active parents and shared 0.
      return {
        records,
        completeness: "incomplete",
        notes: [
          "Choices under unknown absent parent action IDs are not discoverable without scanning every uint16 parent.",
        ],
      }
    },
    write(action, key) {
      const [parent, id] = key.split(":")
      if (action === "remove") return [call("removeActionChoices", parent, [id])]
      return [call(action === "add" ? "addActionChoices" : "editActionChoices", parent, [id], [choices.get(key)])]
    },
  })

  const cosmetics = new Map(cosmeticTokenIds.map((id, i) => [String(id), cosmeticInfos[i]]))
  adapters.push({
    domain: "cosmetics",
    contract: "cosmetics",
    desired: (ctx) => [...cosmetics].map(([id, value]) => row(id, {cosmetic: ctx.value("getCosmetic", value)})),
    async read(ctx) {
      const records = []
      for (const id of await ctx.scan("getCosmeticItemTokenIds", 65536))
        records.push(row(id, {cosmetic: ctx.value("getCosmetic", await ctx.call("getCosmetic", [id]))}))
      return complete(records)
    },
    write: (action, id) => [
      action === "remove" ? call("removeCosmeticItems", [id]) : call("setCosmetics", [id], [cosmetics.get(id)]),
    ],
  })

  const instant = new Map(
    allInstantActions
      .filter((input) => input.isAvailable)
      .map((input) => [`${input.actionType}:${input.actionId}`, input])
  )
  adapters.push({
    domain: "instant-actions",
    contract: "instantActions",
    desired: (ctx) =>
      [...instant].map(([id, input]) =>
        row(id, {
          action: ctx.value("getAction", {
            ...slots(input, {
              minSkills: "minSkill",
              minXPs: "minXP",
              inputTokenIds: "inputTokenId",
              inputAmounts: "inputAmount",
            }),
            packedData: flags({...input, isAvailable: false}),
          }),
        })
      ),
    async read(ctx) {
      const records = []
      for (const type of [0, 1, 2])
        for (const id of await ctx.scan("getActionIds", 65536, [type])) {
          records.push(row(`${type}:${id}`, {action: ctx.value("getAction", await ctx.call("getAction", [type, id]))}))
        }
      return complete(records)
    },
    write(action, key) {
      const [type, id] = key.split(":")
      if (action === "remove") return [call("removeActions", [type], [id])]
      return [call(action === "add" ? "addActions" : "editActions", [instant.get(key)])]
    },
  })

  adapters.push(
    keyed(
      "passive-actions",
      "passiveActions",
      allPassiveActions,
      "actionId",
      {
        getAction: (input) => ({
          ...slots(input.info, {
            minSkills: "minSkill",
            minLevels: "minLevel",
            inputTokenIds: "inputTokenId",
            inputAmounts: "inputAmount",
          }),
          packedData: flags(input.info, input.randomRewards.length ? 32 : 0),
        }),
        getActionRewards: rewards,
      },
      (ctx) => ctx.scan("getActionIds", 65536),
      "addActions",
      "editActions"
    )
  )

  adapters.push(
    keyed(
      "base-pets",
      "petNFT",
      allBasePets,
      "baseId",
      {
        getBasePetMetadata: (input) =>
          slots(
            input,
            {
              skillEnhancements: "skillEnhancement",
              skillFixedMins: "skillFixedMin",
              skillFixedMaxs: "skillFixedMax",
              skillFixedIncrements: "skillFixedIncrement",
              skillPercentageMins: "skillPercentageMin",
              skillPercentageMaxs: "skillPercentageMax",
              skillPercentageIncrements: "skillPercentageIncrement",
              skillMinLevels: "skillMinLevel",
            },
            2
          ),
      },
      (ctx) => ctx.scan("getBasePetIds", 16777216),
      "addBasePets",
      "editBasePets",
      undefined,
      (input, current) => {
        if (
          String(input.skillEnhancements[0]) !== current.value.getBasePetMetadata.skillEnhancement1 ||
          String(input.skillEnhancements[1]) !== current.value.getBasePetMetadata.skillEnhancement2
        ) {
          throw new Error("Base pet enhancement skill pair is immutable")
        }
      }
    )
  )

  adapters.push({
    domain: "xp-threshold-rewards",
    contract: "players",
    notes: [settlementNote],
    desired: (ctx) =>
      ctx
        .value("getXPThresholdRewards", allXPThresholdRewards)
        .map((value: GameDataValue) => row(value.xpThreshold, value)),
    async read(ctx) {
      return complete(
        ctx
          .value("getXPThresholdRewards", await ctx.call("getXPThresholdRewards"))
          .map((value: GameDataValue) => row(value.xpThreshold, value))
      )
    },
    write(action, id) {
      if (action === "remove") return [call("removeXPThresholdRewards", [id])]
      return [
        call(action === "add" ? "addXPThresholdRewards" : "editXPThresholdRewards", [
          allXPThresholdRewards.find((value) => String(value.xpThreshold) === id),
        ]),
      ]
    },
  })
  adapters.push({
    domain: "full-attire-bonuses",
    contract: "players",
    notes: [settlementNote],
    desired: (ctx) => allFullAttireBonuses.map((input) => row(input.skill, ctx.value("getFullAttireBonus", input))),
    async read(ctx) {
      const records = []
      // contracts/globals/misc.sol ends at TRAVELING (39). The TS package also has INCUBATION (40).
      for (let skill = 0; skill < 40; skill++) {
        const value = ctx.value("getFullAttireBonus", await ctx.call("getFullAttireBonus", [skill]))
        if (
          value.itemTokenIds.some((id: string) => id !== "0") ||
          value.bonusXPPercent !== "0" ||
          value.bonusRewardsPercent !== "0"
        )
          records.push(row(skill, value))
      }
      return complete(records)
    },
    write: (action, id) => [
      action === "remove"
        ? call("clearFullAttireBonuses", [id])
        : call("addFullAttireBonuses", [allFullAttireBonuses.find((input) => String(input.skill) === id)]),
    ],
  })

  adapters.push({
    domain: "avatars",
    contract: "playerNFT",
    desired: (ctx) => avatarIds.map((id, i) => row(id, ctx.value("getAvatar", avatarInfos[i]))),
    async read(ctx) {
      const completeness = await discoveryStatus(ctx)
      const keys = new Set([
        ...(await ctx.index("getAvatarIds", await ctx.call("getAvatarCount"))),
        ...avatarIds.map(String),
      ])
      const records = []
      for (const id of keys) {
        const value = ctx.value("getAvatar", await ctx.call("getAvatar", [id]))
        if (
          value.name ||
          value.description ||
          value.imageURI ||
          value.startSkills.some((skill: string) => skill !== "0")
        )
          records.push(row(id, value))
      }
      return {records, completeness}
    },
    write: (action, id) => [
      call(
        "setAvatars",
        [id],
        [
          action === "remove"
            ? {name: "", description: "", imageURI: "", startSkills: [0, 0]}
            : avatarInfos[avatarIds.indexOf(Number(id))],
        ]
      ),
    ],
  })
  for (const [name, pools] of [
    ["Daily", allDailyRewards],
    ["Weekly", allWeeklyRewards],
  ] as const) {
    const getter = `get${name}RewardPool`
    adapters.push({
      domain: `${name.toLowerCase()}-rewards`,
      contract: "dailyRewardsScheduler",
      desired: (ctx) => pools.map((pool, i) => row(i + 1, {pool: ctx.value(getter, pool)})),
      async read(ctx) {
        const completeness = await discoveryStatus(ctx)
        const ids = new Set([
          ...(await ctx.index(`get${name}RewardTiers`, await ctx.call(`get${name}RewardTierCount`))),
          ...pools.map((_, i) => String(i + 1)),
        ])
        const records = []
        for (const id of ids) {
          const pool = ctx.value(getter, await ctx.call(getter, [id]))
          if (pool.length) records.push(row(id, {pool}))
        }
        return {records, completeness}
      },
      write: (action, id) => [call(`set${name}RewardPool`, id, action === "remove" ? [] : pools[Number(id) - 1])],
    })
  }

  const tiers = deployment.profile === "beta" ? allClanTiersBeta : allClanTiers
  const existingTiers = new Set<string>()
  adapters.push({
    domain: "clan-tiers",
    contract: "clans",
    notes: ["Deactivation retains capacities and pricing for existing clans. Price edits use canonical profile data."],
    desired: (ctx) => tiers.map((tier) => row(tier.id, {tier: ctx.value("getTier", tier), active: true})),
    async read(ctx) {
      existingTiers.clear()
      const records = []
      for (const id of await ctx.call("getTierIds")) {
        existingTiers.add(String(id))
        const active = await ctx.call("isTierActive", [id])
        if (active || tiers.some((tier) => String(tier.id) === String(id)))
          records.push(row(id, {tier: ctx.value("getTier", await ctx.call("getTier", [id])), active}))
      }
      return complete(records)
    },
    write(action, id) {
      if (action === "remove") return [call("setTierActive", id, false)]
      return [
        call(existingTiers.has(id) || action === "update" ? "editTiers" : "addTiers", [
          tiers.find((tier) => String(tier.id) === id),
        ]),
        call("setTierActive", id, true),
      ]
    },
  })

  for (const contract of ["territories", "lockedBankVaults", "pvpBattleground"] as const) {
    adapters.push({
      domain:
        contract === "territories"
          ? "territory-battle-skills"
          : contract === "lockedBankVaults"
          ? "locked-vault-battle-skills"
          : "pvp-battle-skills",
      contract,
      notes: ["Skill replacement affects pending battles; it does not snapshot their previous skill pools."],
      desired: () => [
        row("pool", {skills: allBattleSkills.map(String), ...(contract === "pvpBattleground" ? {count: "8"} : {})}),
      ],
      async read(ctx) {
        return complete([
          row("pool", {
            skills: (await ctx.call("getComparableSkills")).map(String),
            ...(contract === "pvpBattleground" ? {count: String(await ctx.call("getNumSkillsToCompare"))} : {}),
          }),
        ])
      },
      write: (_action, _id, current) => [
        {
          ...call("replaceComparableSkills", allBattleSkills, ...(contract === "pvpBattleground" ? [8] : [])),
          destructive: current?.value.skills.some((skill: string) => !allBattleSkills.map(String).includes(skill)),
        },
      ],
    })
  }

  const strategyName = (type: number): ContractName => {
    if (type === 3) return "eggInstantVRFActionStrategy"
    if (type === 1 || type === 2) return "genericInstantVRFActionStrategy"
    throw new Error(`Unsupported VRF action strategy type ${type}`)
  }
  adapters.push({
    domain: "instant-vrf-actions",
    contract: "instantVRFActions",
    desired: (ctx) =>
      allInstantVRFActions.map((input) => {
        const name = strategyName(input.actionType)
        const strategy = ctx.at(deployment.contracts[name].address, loadContractInterface(name))
        const dataType =
          input.actionType === 3
            ? "tuple(uint16 rewardBasePetIdMin,uint16 rewardBasePetIdMax)"
            : "tuple(uint16 itemTokenId,uint16 chance,uint16 amount)[]"
        const data = AbiCoder.defaultAbiCoder().decode(["uint8", dataType], input.data)[1]
        return row(input.actionId, {
          action: ctx.value("getAction", {
            ...slots(input, {inputTokenIds: "inputTokenId", inputAmounts: "inputAmount"}),
            packedData: flags(input),
          }),
          strategy: strategy.value("getAction", data),
        })
      }),
    async read(ctx) {
      const records = []
      for (const id of await ctx.scan("getActionIds", 65536)) {
        const action = ctx.value("getAction", await ctx.call("getAction", [id]))
        const name = strategyName(Number(action.actionType))
        const address = await ctx.call("getStrategy", [action.actionType])
        if (address.toLowerCase() !== deployment.contracts[name].address.toLowerCase())
          throw new Error(`Unexpected VRF strategy wiring for type ${action.actionType}`)
        const strategy = ctx.at(address, loadContractInterface(name))
        records.push(row(id, {action, strategy: strategy.value("getAction", await strategy.call("getAction", [id]))}))
      }
      return complete(records)
    },
    write: (action, id) => [
      action === "remove"
        ? call("removeActions", [id])
        : call(action === "add" ? "addActions" : "editActions", [
            allInstantVRFActions.find((input) => String(input.actionId) === id),
          ]),
    ],
  })

  let territoryCount = 0
  adapters.push({
    domain: "territories",
    contract: "territories",
    notes: [
      "Only IDs, emission percentages and minimum MMR are compared. Occupancy, accrued emissions and timestamps are retained.",
    ],
    desired: () => [
      row("configuration", {
        territories: allTerritories.map((input, i) => ({
          territoryId: String(input.territoryId),
          percentageEmissions: String(input.percentageEmissions),
          minimumMMR: String(allMinimumMMRs[i]),
        })),
      }),
    ],
    async read(ctx) {
      const territories = await ctx.call("getTerrorities")
      territoryCount = territories.length
      return complete([
        row("configuration", {
          territories: territories
            .filter((value: GameDataValue) => value.territoryId !== 0n)
            .map((value: GameDataValue) => ({
              territoryId: String(value.territoryId),
              percentageEmissions: String(value.percentageEmissions),
              minimumMMR: String(value.minimumMMR),
            })),
        }),
      ])
    },
    write(_action, _id, current) {
      const before: GameDataValue[] = current?.value.territories ?? []
      const currentIds = new Set(before.map((entry) => String(entry.territoryId)))
      const desiredIds = new Set(allTerritories.map((entry) => String(entry.territoryId)))
      const remove = before.filter((entry) => !desiredIds.has(entry.territoryId)).map((entry) => entry.territoryId)
      const edit = allTerritories.filter((entry) => currentIds.has(String(entry.territoryId)))
      const restore = allTerritories.filter(
        (entry) => !currentIds.has(String(entry.territoryId)) && entry.territoryId <= territoryCount
      )
      const add = allTerritories
        .filter((entry) => entry.territoryId > territoryCount)
        .sort((a, b) => a.territoryId - b.territoryId)
      if (add.some((entry, i) => entry.territoryId !== territoryCount + i + 1))
        throw new Error("New territory IDs must be sequential")
      return [
        ...remove.map((id) => ({...call("removeTerritories", [id]), destructive: true})),
        ...(edit.length ? [call("editTerritories", edit)] : []),
        ...(restore.length ? [call("restoreTerritories", restore)] : []),
        ...(add.length ? [call("addTerritories", add)] : []),
        call(
          "setMinimumMMRs",
          allTerritories.map((entry) => entry.territoryId),
          allMinimumMMRs
        ),
      ]
    },
  })

  const raidDefinitions = new Map(allBaseRaidIds.map((id, i) => [String(id), allBaseRaids[i]]))
  const existingRaids = new Set<string>()
  let raidDiscoveryComplete = false
  adapters.push({
    domain: "raids",
    contract: "raids",
    notes: [
      "Pool replacement waits for pending spawn requests. Deactivation retains loot definitions used by existing raids.",
    ],
    desired: (ctx) => [
      row("configuration", {
        definitions: [...raidDefinitions]
          .map(([id, value]) => ({id, value: ctx.value("getBaseRaid", value), active: true}))
          .sort((a, b) => a.id.localeCompare(b.id)),
        pool: allBaseRaidIds.map(String),
        configured: true,
      }),
    ],
    async read(ctx) {
      existingRaids.clear()
      const [count, isComplete] = await ctx.call("getBaseRaidDiscoveryState")
      raidDiscoveryComplete = isComplete
      const ids = new Set([
        ...(await ctx.index("getTrackedBaseRaidIds", count)),
        ...(await ctx.scan("getBaseRaidIds", 65536)),
        ...raidDefinitions.keys(),
      ])
      const definitions = []
      for (const id of ids) {
        const value = ctx.value("getBaseRaid", await ctx.call("getBaseRaid", [id]))
        if (value.minHealth === "0") continue
        existingRaids.add(id)
        const active = await ctx.call("isBaseRaidActive", [id])
        if (active || raidDefinitions.has(id)) definitions.push({id, value, active})
      }
      const [pool, configured] = await ctx.call("getBaseRaidSpawnIds")
      return {
        records: [
          row("configuration", {
            definitions: definitions.sort((a, b) => a.id.localeCompare(b.id)),
            pool: pool.map(String),
            configured,
          }),
        ],
        completeness: isComplete ? "complete" : "incomplete",
      }
    },
    write(_action, _id, current) {
      const definitions: GameDataValue[] = current?.value.definitions ?? []
      const stale = definitions.filter((entry) => !raidDefinitions.has(entry.id))
      if (stale.length && !raidDiscoveryComplete)
        throw new Error("Base-raid deactivation requires complete historical discovery")
      const calls = []
      for (const [id, value] of raidDefinitions) {
        calls.push(call(existingRaids.has(id) ? "editBaseRaids" : "addBaseRaids", [id], [value]))
        calls.push(call("setBaseRaidActive", id, true))
      }
      calls.push(call("setBaseRaidSpawnIds", allBaseRaidIds))
      for (const entry of stale) calls.push({...call("setBaseRaidActive", entry.id, false), destructive: true})
      return calls
    },
  })

  for (const contract of ["bazaar", "orderbookV2"] as const) {
    const immutableTicks = new Map<string, string>()
    adapters.push({
      domain: `orderbook-token-constraints:${contract}`,
      contract,
      desired: (ctx) => allOrderBookTokenIdInfos.map((input) => row(input.tokenId, ctx.value("getTokenIdInfo", input))),
      async read(ctx) {
        immutableTicks.clear()
        const [count, isComplete] = await ctx.call("getTokenIdDiscoveryState")
        const keys = new Set([
          ...(await ctx.index("getKnownTokenIds", count)),
          ...allOrderBookTokenIdInfos.map((input) => String(input.tokenId)),
        ])
        const records = []
        for (const id of keys) {
          immutableTicks.set(id, String(await ctx.call("getImmutableTick", [id])))
          const value = ctx.value("getTokenIdInfo", await ctx.call("getTokenIdInfo", [id]))
          if (value.tick !== "0" || value.minQuantity !== "0") records.push(row(id, value))
        }
        return {records, completeness: isComplete ? "complete" : "incomplete"}
      },
      write(action, id, current) {
        if (action === "remove") return [call("removeTokenIdInfos", [id])]
        const input = allOrderBookTokenIdInfos.find((input) => String(input.tokenId) === id)!
        const tick = immutableTicks.get(id) ?? current?.value.tick ?? "0"
        if (tick !== "0" && tick !== String(input.tick)) throw new Error("OrderBook tick is immutable")
        return [call("setTokenIdInfos", [id], [input])]
      },
      notes: [
        "Removal requires an empty bid and ask book. Retained immutable ticks are checked even for removed records; no reset bypass is used.",
      ],
    })
  }
  return adapters
}
