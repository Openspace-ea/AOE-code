import chalk from 'chalk'
import * as React from 'react'
import { Box, Text, useInput } from '../../ink.js'
import type { CommandResultDisplay } from '../../commands.js'
import type { LocalJSXCommandCall } from '../../types/command.js'
import { getGlobalConfig, saveGlobalConfig } from '../../utils/config.js'
import {
  getCompanion,
  setCompanionPreferences,
  clearCompanionPreferences,
  companionUserId,
  roll,
} from '../../buddy/companion.js'
import {
  SPECIES,
  EYES,
  HATS,
  RARITY_COLORS,
  RARITY_STARS,
  type Species,
  type Eye,
  type Hat,
} from '../../buddy/types.js'
import { renderFace } from '../../buddy/sprites.js'

function hatchCompanion(): void {
  const userId = companionUserId()
  const { bones, inspirationSeed } = roll(userId)
  const nameMap: Record<string, string[]> = {
    duck: ['小黄', '嘎嘎', '达菲'],
    goose: ['大白', '鹅鹅', '曲项'],
    blob: ['果冻', '水滴', '泡泡'],
    cat: ['咪咪', '小橘', '布丁'],
    dragon: ['小龙', '火焰', '龙龙'],
    octopus: ['小章', '触手', '墨墨'],
    owl: ['咕咕', '夜枭', '慧慧'],
    penguin: ['企企', '黑黑', '冰冰'],
    turtle: ['龟龟', '慢慢', '壳壳'],
    snail: ['蜗蜗', '慢慢', '螺螺'],
    ghost: ['幽幽', '小白', '飘飘'],
    axolotl: ['六六', '萌萌', '粉粉'],
    capybara: ['水豚', '大大', '呆呆'],
    cactus: ['刺刺', '绿绿', '沙漠'],
    robot: ['铁铁', '滴滴', '机器'],
    rabbit: ['兔兔', '白白', '蹦蹦'],
    mushroom: ['蘑菇', '伞伞', '菌菌'],
    chonk: ['胖胖', '圆圆', '肉肉'],
  }
  const names = nameMap[bones.species] || ['伙伴']
  const name = names[Math.floor(Math.random() * names.length)]
  saveGlobalConfig(current => ({
    ...current,
    companion: {
      name,
      personality: '忠诚的伙伴',
      hatchedAt: Date.now(),
    },
  }))
}

const SPECIES_NAMES: Record<string, string> = {
  duck: '鸭子',
  goose: '鹅',
  blob: '水滴',
  cat: '猫',
  dragon: '龙',
  octopus: '章鱼',
  owl: '猫头鹰',
  penguin: '企鹅',
  turtle: '乌龟',
  snail: '蜗牛',
  ghost: '幽灵',
  axolotl: '六角恐龙',
  capybara: '水豚',
  cactus: '仙人掌',
  robot: '机器人',
  rabbit: '兔子',
  mushroom: '蘑菇',
  chonk: '胖猫',
}

const HAT_NAMES: Record<string, string> = {
  none: '无帽子',
  crown: '皇冠',
  tophat: '礼帽',
  propeller: '螺旋桨',
  halo: '光环',
  wizard: '巫师帽',
  beanie: '毛线帽',
  tinyduck: '小黄鸭',
}

const HAT_STYLES: Record<string, string> = {
  none: '',
  crown: '\\^^^/',
  tophat: '[___]',
  propeller: '-+-',
  halo: '(   )',
  wizard: '/^\\',
  beanie: '(___)',
  tinyduck: ',>',
}

type Page = 'main' | 'species' | 'eyes' | 'hats'

function BuddySelector({ onDone }: { onDone: (result?: string, options?: { display?: CommandResultDisplay }) => void }) {
  const [page, setPage] = React.useState<Page>('main')
  const [cursor, setCursor] = React.useState(0)
  const [companion, setCompanion] = React.useState(getCompanion())
  const prefs = getGlobalConfig().companionPreferences
  const isMuted = getGlobalConfig().companionMuted

  React.useEffect(() => {
    if (!companion) {
      hatchCompanion()
      setCompanion(getCompanion())
    }
  }, [])

  const mainItems = companion ? [
    { label: '🐾 更换物种', value: 'species' as Page, desc: '选择你喜欢的宠物种类' },
    { label: '👁️ 更换眼睛', value: 'eyes' as Page, desc: '改变宠物的眼睛样式' },
    { label: '🎩 更换帽子', value: 'hats' as Page, desc: '给宠物戴上可爱的帽子' },
    { label: '🎲 恢复随机', value: 'reset' as Page, desc: '恢复为系统随机分配的外观' },
  ] : []

  const speciesItems = SPECIES.map(s => ({
    label: `${SPECIES_NAMES[s] || s}`,
    value: s,
  }))

  const eyeItems = EYES.map(e => ({
    label: e,
    value: e,
  }))

  const hatItems = HATS.map(h => ({
    label: `${HAT_NAMES[h] || h}${h !== 'none' ? `  ${HAT_STYLES[h]}` : ''}`,
    value: h,
  }))

  const currentItems = page === 'main' ? mainItems
    : page === 'species' ? speciesItems
    : page === 'eyes' ? eyeItems
    : hatItems

  useInput((input, key) => {
    if (key.upArrow || input === 'k') {
      setCursor(c => (c - 1 + currentItems.length) % currentItems.length)
    } else if (key.downArrow || input === 'j') {
      setCursor(c => (c + 1) % currentItems.length)
    } else if (key.return || input === ' ') {
      if (page === 'main') {
        const selected = mainItems[cursor]
        if (selected?.value === 'reset') {
          clearCompanionPreferences()
          onDone('已恢复为随机宠物', { display: 'system' })
        } else {
          setPage(selected?.value || 'species')
          setCursor(0)
        }
      } else if (page === 'species') {
        const species = speciesItems[cursor]?.value
        if (species) {
          setCompanionPreferences({ species })
          onDone(`已更换为 ${chalk.bold(SPECIES_NAMES[species] || species)}`, { display: 'system' })
        }
      } else if (page === 'eyes') {
        const eye = eyeItems[cursor]?.value
        if (eye) {
          setCompanionPreferences({ eye })
          onDone(`已更换眼睛为 ${chalk.bold(eye)}`, { display: 'system' })
        }
      } else if (page === 'hats') {
        const hat = hatItems[cursor]?.value
        if (hat) {
          setCompanionPreferences({ hat })
          onDone(`已更换帽子为 ${chalk.bold(HAT_NAMES[hat] || hat)}${hat !== 'none' ? ` ${HAT_STYLES[hat]}` : ''}`, { display: 'system' })
        }
      }
    } else if (key.escape || input === 'q') {
      if (page !== 'main') {
        setPage('main')
        setCursor(0)
      } else {
        onDone('已取消', { display: 'system' })
      }
    }
  })

  const pageTitle = page === 'main' ? '🐾 宠物管理'
    : page === 'species' ? '🐾 选择物种'
    : page === 'eyes' ? '👁️ 选择眼睛'
    : '🎩 选择帽子'

  const pageHint = page === 'main' ? '选择下方操作来管理你的宠物'
    : page === 'species' ? '选择你喜欢的宠物种类，按 Enter 确认'
    : page === 'eyes' ? '选择眼睛样式，按 Enter 确认'
    : '选择帽子，按 Enter 确认'

  return (
    <Box flexDirection="column" padding={1}>
      {/* 标题区 */}
      <Box marginBottom={1} flexDirection="column">
        <Text bold color="cyan">{pageTitle}</Text>
        <Text dimColor>{pageHint}</Text>
      </Box>

      {/* 当前宠物信息 */}
      {companion && page === 'main' && (
        <Box marginBottom={1} flexDirection="column" borderStyle="round" borderColor="gray" paddingX={1}>
          <Text>
            <Text bold color={RARITY_COLORS[companion.rarity]}>{companion.name}</Text>
            {' '}{RARITY_STARS[companion.rarity]}
            {isMuted && <Text dimColor> (已隐藏)</Text>}
          </Text>
          <Text dimColor>
            物种：{SPECIES_NAMES[companion.species] || companion.species}
            {' │ '}眼睛：{companion.eye}
            {' │ '}帽子：{HAT_NAMES[companion.hat] || companion.hat}{companion.hat !== 'none' ? ` ${HAT_STYLES[companion.hat]}` : ''}
          </Text>
          {prefs && (
            <Text dimColor>✨ 已自定义外观</Text>
          )}
        </Box>
      )}

      {/* 菜单列表 */}
      {currentItems.map((item, i) => (
        <Box key={item.value} flexDirection="column">
          <Box>
            <Text>
              {i === cursor ? <Text color="cyan">{' ▸ '}</Text> : '   '}
              {i === cursor ? <Text bold color="cyan">{item.label}</Text> : <Text dimColor>{item.label}</Text>}
            </Text>
          </Box>
          {page === 'main' && i === cursor && 'desc' in item && (
            <Box paddingLeft={5}>
              <Text dimColor>{(item as any).desc}</Text>
            </Box>
          )}
        </Box>
      ))}

      {/* 操作提示 */}
      <Box marginTop={1} flexDirection="column" borderStyle="single" borderColor="gray" paddingX={1}>
        <Text dimColor>
          <Text bold>操作指南：</Text>
        </Text>
        <Text dimColor>  ↑/k ↓/j  移动光标    Enter/空格  确认选择</Text>
        <Text dimColor>  Esc/q    返回上级      Ctrl+C     退出菜单</Text>
      </Box>

      {/* 快捷命令提示 */}
      {page === 'main' && (
        <Box marginTop={1} flexDirection="column">
          <Text dimColor>
            <Text bold>快捷命令：</Text>
          </Text>
          <Text dimColor>  /buddy info     查看宠物详细信息</Text>
          <Text dimColor>  /buddy mute     隐藏宠物</Text>
          <Text dimColor>  /buddy unmute   显示宠物</Text>
          <Text dimColor>  /buddy help     查看所有命令</Text>
        </Box>
      )}
    </Box>
  )
}

export const call: LocalJSXCommandCall = async (onDone, _context, args) => {
  args = args?.trim() || ''

  if (args === 'help' || args === '--help') {
    onDone(
      '🐾 桌面宠物系统\n' +
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
      '你的宠物会陪伴你编码，偶尔还会发表评论！\n\n' +
      '📋 命令列表：\n' +
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
      '  /buddy                 打开宠物管理菜单\n' +
      '  /buddy info            查看宠物详细信息\n' +
      '  /buddy mute            隐藏宠物\n' +
      '  /buddy unmute          显示宠物\n' +
      '  /buddy reset           恢复随机外观\n\n' +
      '🎨 快捷设置：\n' +
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
      '  /buddy species <名称>  设置物种\n' +
      '      可用：鸭子、鹅、水滴、猫、龙、章鱼、\n' +
      '            猫头鹰、企鹅、乌龟、蜗牛、幽灵、\n' +
      '            六角恐龙、水豚、仙人掌、机器人、\n' +
      '            兔子、蘑菇、胖猫\n\n' +
      '  /buddy eye <符号>      设置眼睛\n' +
      '      可用：· ✦ × ◉ @ °\n\n' +
      '  /buddy hat <名称>      设置帽子\n' +
      '      可用：\n' +
      '        crown(皇冠 \\^^^/)、tophat(礼帽 [___])、\n' +
      '        propeller(螺旋桨 -+-)、halo(光环 (   ))、\n' +
      '        wizard(巫师帽 /^\\)、beanie(毛线帽 (___))、\n' +
      '        tinyduck(小黄鸭 ,>)\n\n' +
      '💡 提示：\n' +
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
      '  • 首次运行 /buddy 会自动孵化一只宠物\n' +
      '  • 宠物外观基于你的账号唯一生成\n' +
      '  • 稀有度越高，宠物越特别哦！',
      { display: 'system' }
    )
    return
  }

  if (args === 'info') {
    let companion = getCompanion()
    if (!companion) {
      hatchCompanion()
      companion = getCompanion()
    }
    if (!companion) {
      onDone('孵化宠物失败', { display: 'system' })
      return
    }
    const isMuted = getGlobalConfig().companionMuted
    onDone(
      '🐾 宠物信息\n' +
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
      `  名称：${companion.name}\n` +
      `  物种：${SPECIES_NAMES[companion.species] || companion.species}\n` +
      `  稀有度：${companion.rarity} ${RARITY_STARS[companion.rarity]}\n` +
      `  眼睛：${companion.eye}\n` +
      `  帽子：${HAT_NAMES[companion.hat] || companion.hat}${companion.hat !== 'none' ? ` ${HAT_STYLES[companion.hat]}` : ''}\n` +
      `  状态：${isMuted ? '已隐藏' : '显示中'}\n` +
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
      '  属性值：\n' +
      `    调试：${companion.stats.DEBUGGING}\n` +
      `    耐心：${companion.stats.PATIENCE}\n` +
      `    混乱：${companion.stats.CHAOS}\n` +
      `    智慧：${companion.stats.WISDOM}\n` +
      `    毒舌：${companion.stats.SNARK}\n` +
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
      '  使用 /buddy 打开管理菜单',
      { display: 'system' }
    )
    return
  }

  if (args === 'mute') {
    saveGlobalConfig(c => ({ ...c, companionMuted: true }))
    onDone('🐾 宠物已隐藏\n使用 /buddy unmute 可重新显示', { display: 'system' })
    return
  }

  if (args === 'unmute') {
    saveGlobalConfig(c => ({ ...c, companionMuted: false }))
    onDone('🐾 宠物已显示', { display: 'system' })
    return
  }

  if (args === 'reset') {
    clearCompanionPreferences()
    onDone('🎲 已恢复为随机宠物外观', { display: 'system' })
    return
  }

  // Direct set commands
  if (args.startsWith('species ')) {
    const species = args.slice(8).trim().toLowerCase()
    if (SPECIES.includes(species as any)) {
      setCompanionPreferences({ species })
      onDone(`🐾 已更换为 ${chalk.bold(SPECIES_NAMES[species] || species)}`, { display: 'system' })
    } else {
      onDone(
        `❌ 未知物种: ${species}\n\n` +
        '可用物种：\n' +
        `  ${SPECIES.map(s => SPECIES_NAMES[s] || s).join('、')}`,
        { display: 'system' }
      )
    }
    return
  }

  if (args.startsWith('eye ')) {
    const eye = args.slice(4).trim()
    if (EYES.includes(eye as any)) {
      setCompanionPreferences({ eye })
      onDone(`👁️ 已更换眼睛为 ${chalk.bold(eye)}`, { display: 'system' })
    } else {
      onDone(
        `❌ 未知眼睛: ${eye}\n\n` +
        `可用眼睛：${EYES.join(' ')}`,
        { display: 'system' }
      )
    }
    return
  }

  if (args.startsWith('hat ')) {
    const hat = args.slice(4).trim().toLowerCase()
    if (HATS.includes(hat as any)) {
      setCompanionPreferences({ hat })
      onDone(`🎩 已更换帽子为 ${chalk.bold(HAT_NAMES[hat] || hat)}${hat !== 'none' ? ` ${HAT_STYLES[hat]}` : ''}`, { display: 'system' })
    } else {
      onDone(
        `❌ 未知帽子: ${hat}\n\n` +
        '可用帽子：\n' +
        '  crown(皇冠 \\^^^/)、tophat(礼帽 [___])、\n' +
        '  propeller(螺旋桨 -+-)、halo(光环 (   ))、\n' +
        '  wizard(巫师帽 /^\\)、beanie(毛线帽 (___))、\n' +
        '  tinyduck(小黄鸭 ,>)',
        { display: 'system' }
      )
    }
    return
  }

  // Default: show interactive selector
  return <BuddySelector onDone={onDone} />
}
