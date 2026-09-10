import * as React from 'react';
import { Box, Text } from '../../ink.js';

export type ClawdPose = 'default' | 'arms-up' | 'look-left' | 'look-right'

type Props = {
  pose?: ClawdPose;
};

const C = '#00FFFF';
const B = '#777777';
const S = '#FFD700';

function line(s: string, hlStart: number, hlLen: number): React.ReactElement {
  const hlEnd = hlStart + hlLen;
  const before = s.slice(0, hlStart);
  const beam = s.slice(hlStart, hlEnd);
  const after = s.slice(hlEnd);
  return (
    <Text>
      {before && <Text color={B}>{before}</Text>}
      {beam && <Text color={C}>{beam}</Text>}
      {after && <Text color={B}>{after}</Text>}
    </Text>
  );
}

export function Clawd({ pose = 'default' }: Props): React.ReactElement {
  return (
    <Box flexDirection="column">
      <Text color={S}>{'·  ·   ✦    ·  ·  ✦    ·   ·'}
      </Text>
      <Text color={S}>{'  ·  ✦    ·      ·   ✦  ·  '}
      </Text>
      {line(' █████╗  ██████╗ ███████╗', 0, 6)}
      {line('██╔══██╗██╔═══██╗██╔════╝', 1, 8)}
      {line('███████║██║   ██║█████╗  ', 2, 10)}
      {line('██╔══██║██║   ██║██╔══╝  ', 3, 12)}
      {line('██║  ██║╚██████╔╝███████╗', 4, 14)}
      {line('╚═╝  ╚═╝ ╚═════╝ ╚══════╝', 5, 16)}
      <Text color={C}>{'─────────────────────────────'}</Text>
    </Box>
  );
}
