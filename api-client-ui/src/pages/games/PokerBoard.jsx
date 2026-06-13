import { useEffect, useState } from "react";
import { Bot, CircleDollarSign, Crown } from "lucide-react";
import UserAvatar from "../../common/UserAvatar.jsx";
import { GameResultSpotlight, PlayingCardArt, playingCardSuitLabel } from "./GameUxAssets.jsx";

const get = (obj, snake, camel, fallback = undefined) => obj?.[camel] ?? obj?.[snake] ?? fallback;
const listOf = (value) => (Array.isArray(value) ? value : []);
const seatNoOf = (player) => Number(get(player, "seat_no", "seatNo", 0));

const pokerPhaseLabels = {
  OPENING_BET: "첫 베팅",
  PREFLOP: "프리플롭",
  FLOP: "플롭",
  TURN: "턴",
  RIVER: "리버",
  DRAW: "카드 교체",
  FINAL_BET: "마지막 베팅",
  HAND_FINISHED: "핸드 종료",
  FINISHED: "게임 종료",
};

const pokerCardRank = (card) => get(card, "rank", "rank", "");
const pokerCardSuit = (card) => get(card, "suit", "suit", "");
const pokerCardValue = (card) => Number(get(card, "value", "value", 0));
const pokerCardId = (card) => get(card, "id", "id", `${pokerCardRank(card)}-${pokerCardSuit(card)}`);

const pokerValueLabel = (value) => {
  if (value === 14) return "A";
  if (value === 13) return "K";
  if (value === 12) return "Q";
  if (value === 11) return "J";
  return String(value || "");
};

const pokerHandTone = (category) => {
  if (category >= 6) return "bg-rose-50 text-rose-700";
  if (category >= 4) return "bg-amber-50 text-amber-700";
  if (category >= 2) return "bg-emerald-50 text-emerald-700";
  if (category >= 1) return "bg-sky-50 text-sky-700";
  return "bg-slate-100 text-slate-600";
};

const comparePokerRanks = (left = [], right = []) => {
  const max = Math.max(left.length, right.length);
  for (let index = 0; index < max; index += 1) {
    const a = left[index] || 0;
    const b = right[index] || 0;
    if (a !== b) return a - b;
  }
  return 0;
};

const pokerStraightHigh = (valuesDesc) => {
  const values = [...new Set(valuesDesc)];
  if (values.includes(14)) values.push(1);
  for (const start of values) {
    if ([1, 2, 3, 4].every((offset) => values.includes(start - offset))) return start;
  }
  return 0;
};

const evaluateFivePokerCards = (cards) => {
  const counts = cards.reduce((acc, card) => {
    const value = pokerCardValue(card);
    if (!value) return acc;
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
  const valuesDesc = Object.keys(counts).map(Number).sort((a, b) => b - a);
  const flush = cards.length === 5 && new Set(cards.map(pokerCardSuit)).size === 1;
  const straightHigh = pokerStraightHigh(valuesDesc);
  const ranksWithCount = (count) => valuesDesc.filter((value) => counts[value] === count);
  const highestExcept = (...excluded) => valuesDesc.find((value) => !excluded.includes(value)) || 0;

  if (flush && straightHigh) return { category: 8, ranks: [straightHigh], label: "스트레이트 플러시" };
  const fours = ranksWithCount(4);
  if (fours.length) return { category: 7, ranks: [fours[0], highestExcept(fours[0])], label: "포카드" };
  const threes = ranksWithCount(3);
  const pairs = ranksWithCount(2);
  if (threes.length && (pairs.length || threes.length > 1)) {
    return { category: 6, ranks: [threes[0], pairs[0] || threes[1]], label: "풀하우스" };
  }
  if (flush) return { category: 5, ranks: valuesDesc, label: "플러시" };
  if (straightHigh) return { category: 4, ranks: [straightHigh], label: "스트레이트" };
  if (threes.length) return { category: 3, ranks: [threes[0], ...valuesDesc.filter((value) => value !== threes[0]).slice(0, 2)], label: "트리플" };
  if (pairs.length >= 2) return { category: 2, ranks: [pairs[0], pairs[1], highestExcept(pairs[0], pairs[1])], label: "투페어" };
  if (pairs.length === 1) return { category: 1, ranks: [pairs[0], ...valuesDesc.filter((value) => value !== pairs[0]).slice(0, 3)], label: "원페어" };
  return { category: 0, ranks: valuesDesc, label: "하이카드" };
};

const evaluatePokerHand = (cards) => {
  const validCards = cards.filter((card) => pokerCardValue(card));
  if (validCards.length < 5) {
    return { ready: false, category: 0, ranks: [], label: "아직 5장 미만", summary: "공개 카드가 더 필요합니다." };
  }
  let best = null;
  for (let a = 0; a < validCards.length - 4; a += 1) {
    for (let b = a + 1; b < validCards.length - 3; b += 1) {
      for (let c = b + 1; c < validCards.length - 2; c += 1) {
        for (let d = c + 1; d < validCards.length - 1; d += 1) {
          for (let e = d + 1; e < validCards.length; e += 1) {
            const value = evaluateFivePokerCards([validCards[a], validCards[b], validCards[c], validCards[d], validCards[e]]);
            if (!best || value.category > best.category || (value.category === best.category && comparePokerRanks(value.ranks, best.ranks) > 0)) {
              best = value;
            }
          }
        }
      }
    }
  }
  const highText = best?.ranks?.length ? `${pokerValueLabel(best.ranks[0])} 기준` : "";
  return { ready: true, ...best, summary: highText };
};

const drawPokerAdvice = (cards) => {
  if (cards.length < 5) return { message: "5장이 보이면 교체 추천이 표시됩니다.", suggestedIds: [] };
  const hand = evaluatePokerHand(cards);
  if (hand.category >= 4) return { message: `${hand.label}입니다. 이미 강한 족보라 교체 없이 유지가 안전합니다.`, suggestedIds: [] };

  const counts = cards.reduce((acc, card) => {
    const value = pokerCardValue(card);
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
  const keepRanks = Object.entries(counts).filter(([, count]) => count >= 2).map(([value]) => Number(value));
  if (keepRanks.length) {
    const suggestedIds = cards
      .filter((card) => !keepRanks.includes(pokerCardValue(card)))
      .sort((a, b) => pokerCardValue(a) - pokerCardValue(b))
      .slice(0, 3)
      .map(pokerCardId);
    return { message: `${hand.label}은 유지하고 나머지 낮은 카드를 교체하는 쪽이 무난합니다.`, suggestedIds };
  }

  const suitCounts = cards.reduce((acc, card) => {
    const suit = pokerCardSuit(card);
    acc[suit] = (acc[suit] || 0) + 1;
    return acc;
  }, {});
  const flushSuit = Object.entries(suitCounts).find(([, count]) => count >= 4)?.[0];
  if (flushSuit) {
    const suggestedIds = cards.filter((card) => pokerCardSuit(card) !== flushSuit).slice(0, 1).map(pokerCardId);
    return { message: "같은 무늬가 4장입니다. 다른 무늬 1장만 바꾸면 플러시를 노릴 수 있습니다.", suggestedIds };
  }

  const suggestedIds = cards
    .filter((card) => pokerCardValue(card) < 11)
    .sort((a, b) => pokerCardValue(a) - pokerCardValue(b))
    .slice(0, 3)
    .map(pokerCardId);
  return {
    message: suggestedIds.length ? "완성 족보가 없습니다. 낮은 카드부터 최대 3장 교체해 높은 카드나 페어를 노리세요." : "높은 카드가 많습니다. 큰 교체보다 0~1장 교체가 안정적입니다.",
    suggestedIds,
  };
};

const PokerCard = ({ card, hidden = false, compact = false, selected = false, suggested = false }) => {
  return (
    <PlayingCardArt
      rank={pokerCardRank(card)}
      suit={pokerCardSuit(card)}
      hidden={hidden || !card}
      compact={compact}
      selected={selected}
      suggested={suggested}
      smoke="poker-card-art"
    />
  );
};

const pokerPlayerName = (roomPlayers, player) => {
  const seatNo = Number(get(player, "seat_no", "seatNo", 0));
  if (get(player, "bot", "bot", false)) return get(player, "name", "name", `AI ${seatNo}`);
  return roomPlayers.find((roomPlayer) => seatNoOf(roomPlayer) === seatNo)?.nickname || get(player, "name", "name", `플레이어 ${seatNo}`);
};

const pokerPlayerProfileUrl = (roomPlayers, player) => {
  const seatNo = Number(get(player, "seat_no", "seatNo", 0));
  return roomPlayers.find((roomPlayer) => seatNoOf(roomPlayer) === seatNo)?.profileUrl || "";
};

const pokerPlayerLevelMeta = (roomPlayers, player) => {
  const seatNo = Number(get(player, "seat_no", "seatNo", 0));
  const roomPlayer = roomPlayers.find((candidate) => seatNoOf(candidate) === seatNo);
  return {
    level: roomPlayer?.level,
    rewardTier: roomPlayer?.rewardTier,
    frameCode: roomPlayer?.frameCode,
  };
};

const roughPokerAdvice = (myCards, communityCards, callAmount, pot, { isFiveCardDraw = false } = {}) => {
  if (!myCards.length) return "내 카드가 공개되면 추천이 표시됩니다.";
  if (isFiveCardDraw && myCards.length >= 5) {
    return drawPokerAdvice(myCards).message;
  }
  const handInfo = evaluatePokerHand([...myCards, ...communityCards]);
  if (handInfo.ready && handInfo.category >= 3) return `${handInfo.label}입니다. 강한 완성 족보라 상대 베팅 크기를 보며 팟을 키울 수 있습니다.`;
  if (handInfo.ready && handInfo.category >= 1) return `${handInfo.label}입니다. 콜 비용이 과하지 않으면 이어갈 만합니다.`;
  const cards = [...myCards, ...communityCards];
  const values = cards.map(pokerCardValue).filter(Boolean);
  const counts = values.reduce((acc, value) => ({ ...acc, [value]: (acc[value] || 0) + 1 }), {});
  const maxCount = Math.max(0, ...Object.values(counts));
  const pairCount = Object.values(counts).filter((count) => count >= 2).length;
  const suitCounts = cards.reduce((acc, card) => {
    const suit = pokerCardSuit(card);
    return suit ? { ...acc, [suit]: (acc[suit] || 0) + 1 } : acc;
  }, {});
  const flushDraw = Math.max(0, ...Object.values(suitCounts)) >= 4;
  const highCards = myCards.filter((card) => pokerCardValue(card) >= 11).length;
  const potOdds = callAmount > 0 ? callAmount / Math.max(1, pot + callAmount) : 0;
  if (!communityCards.length) {
    if (myCards[0] && myCards[1] && pokerCardValue(myCards[0]) === pokerCardValue(myCards[1])) return "포켓 페어입니다. 큰 레이즈가 아니면 적극적으로 볼 만합니다.";
    if (highCards >= 2) return "높은 카드 두 장입니다. 콜 비용이 낮으면 참여 가치가 있습니다.";
    if (callAmount === 0) return "무료 체크가 가능하면 플롭을 보고 판단하세요.";
    return "초반 패가 약합니다. 콜 비용이 크면 폴드가 안전합니다.";
  }
  if (maxCount >= 3) return "트리플 이상입니다. 팟을 키울 수 있는 강한 상황입니다.";
  if (pairCount >= 2) return "투페어 이상 가능성이 있습니다. 상대 베팅 크기만 확인하세요.";
  if (pairCount === 1) return "페어가 있습니다. 콜 비용이 과하지 않으면 이어갈 만합니다.";
  if (flushDraw) return "플러시 드로우가 있습니다. 팟오즈가 낮으면 콜 가치가 있습니다.";
  if (callAmount === 0) return "완성 족보가 약해도 무료 체크로 다음 카드를 볼 수 있습니다.";
  return potOdds <= 0.18 ? "콜 비용이 낮습니다. 한 장 더 보는 선택이 가능합니다." : "완성된 족보가 약합니다. 큰 콜은 피하는 편이 안전합니다.";
};

const pokerSeatNoOf = (player) => Number(get(player, "seat_no", "seatNo", 0));

const pokerResultHandText = (summary) => {
  const rankLabel = String(get(summary.player, "hand_rank_label", "handRankLabel", "") || "").trim();
  if (rankLabel) return rankLabel;
  if (!summary.hand.ready) return "공개되지 않은 패";
  return `${summary.hand.label}${summary.hand.summary ? `(${summary.hand.summary})` : ""}`;
};

const pokerResultRankText = (hand) => {
  if (!hand?.ranks?.length) return "";
  return hand.ranks.map(pokerValueLabel).filter(Boolean).join(", ");
};

const comparePokerHands = (left, right) => {
  if (!left?.ready && !right?.ready) return 0;
  if (!left?.ready) return -1;
  if (!right?.ready) return 1;
  if (left.category !== right.category) return left.category - right.category;
  return comparePokerRanks(left.ranks, right.ranks);
};

const buildPokerResultExplanation = ({ gameState, pokerPlayers, roomPlayers, communityCards, isFiveCardDraw, winnerSeatNo, lastPot, pot }) => {
  const stateWinnerSeatNos = listOf(get(gameState, "winner_seat_nos", "winnerSeatNos", []))
    .map(Number)
    .filter(Boolean);
  const flaggedWinnerSeatNos = pokerPlayers
    .filter((player) => Boolean(get(player, "winner", "winner", false)) || Boolean(get(player, "won", "won", false)))
    .map(pokerSeatNoOf)
    .filter(Boolean);
  const winnerSeatNos = [...new Set([
    ...(winnerSeatNo ? [winnerSeatNo] : []),
    ...stateWinnerSeatNos,
    ...flaggedWinnerSeatNos,
  ])];
  const activePlayers = pokerPlayers.filter((player) => !Boolean(get(player, "folded", "folded", false)));
  if (!winnerSeatNos.length && activePlayers.length === 1) {
    winnerSeatNos.push(pokerSeatNoOf(activePlayers[0]));
  }
  if (!winnerSeatNos.length) return "";

  const summaries = pokerPlayers.map((player) => {
    const seatNo = pokerSeatNoOf(player);
    const cards = listOf(get(player, "hole_cards", "holeCards", []));
    const hand = evaluatePokerHand(isFiveCardDraw ? cards : [...cards, ...communityCards]);
    return {
      player,
      seatNo,
      name: pokerPlayerName(roomPlayers, player),
      folded: Boolean(get(player, "folded", "folded", false)),
      hand,
    };
  });
  const winnerSummaries = summaries.filter((summary) => winnerSeatNos.includes(summary.seatNo));
  if (!winnerSummaries.length) return "";

  const potText = Number(lastPot || pot || 0) > 0 ? `팟 ${Number(lastPot || pot)}칩을 ` : "팟을 ";
  const winnerNames = winnerSummaries.map((summary) => `${summary.name}님`).join(", ");
  const showdownSummaries = summaries.filter((summary) => !summary.folded && summary.hand.ready);
  const foldedOpponents = summaries.filter((summary) => summary.folded && !winnerSeatNos.includes(summary.seatNo));

  if (!showdownSummaries.length && foldedOpponents.length) {
    return `${winnerNames}이 다른 플레이어의 폴드로 승부 공개 없이 ${potText}획득했습니다.`;
  }

  const sortedWinners = [...winnerSummaries].sort((left, right) => comparePokerHands(right.hand, left.hand));
  const bestWinner = sortedWinners[0];
  const winnerHandText = pokerResultHandText(bestWinner);
  const opponentSummaries = summaries
    .filter((summary) => !winnerSeatNos.includes(summary.seatNo) && !summary.folded && summary.hand.ready)
    .sort((left, right) => comparePokerHands(right.hand, left.hand));

  if (winnerSummaries.length > 1) {
    return `${winnerNames}이 ${winnerHandText}로 동률이 되어 ${potText}나눠 가졌습니다.`;
  }
  if (!bestWinner.hand.ready || !opponentSummaries.length) {
    return `${winnerNames}이 ${winnerHandText}로 ${potText}획득했습니다.`;
  }

  const bestOpponent = opponentSummaries[0];
  const opponentHandText = pokerResultHandText(bestOpponent);
  const sameCategory = bestWinner.hand.category === bestOpponent.hand.category;
  const winnerRanks = pokerResultRankText(bestWinner.hand);
  const opponentRanks = pokerResultRankText(bestOpponent.hand);
  const tieBreakerText = sameCategory && winnerRanks && opponentRanks
    ? ` 같은 ${bestWinner.hand.label}였지만 비교 카드가 ${winnerRanks} 대 ${opponentRanks}로 앞섰습니다.`
    : "";
  return `${winnerNames}이 ${winnerHandText}로 ${bestOpponent.name}님의 ${opponentHandText}보다 앞서 ${potText}획득했습니다.${tieBreakerText}`;
};

const buildPokerShowdownBreakdown = ({ gameState, pokerPlayers, roomPlayers, communityCards, isFiveCardDraw, winnerSeatNo, lastPot, pot }) => {
  const stateWinnerSeatNos = listOf(get(gameState, "winner_seat_nos", "winnerSeatNos", []))
    .map(Number)
    .filter(Boolean);
  const flaggedWinnerSeatNos = pokerPlayers
    .filter((player) => Boolean(get(player, "winner", "winner", false)) || Boolean(get(player, "won", "won", false)))
    .map(pokerSeatNoOf)
    .filter(Boolean);
  const winnerSeatNos = [...new Set([
    ...(winnerSeatNo ? [winnerSeatNo] : []),
    ...stateWinnerSeatNos,
    ...flaggedWinnerSeatNos,
  ])];
  const activePlayers = pokerPlayers.filter((player) => !Boolean(get(player, "folded", "folded", false)));
  if (!winnerSeatNos.length && activePlayers.length === 1) {
    winnerSeatNos.push(pokerSeatNoOf(activePlayers[0]));
  }
  if (!winnerSeatNos.length) return null;

  const summaries = pokerPlayers.map((player) => {
    const seatNo = pokerSeatNoOf(player);
    const holeCards = listOf(get(player, "hole_cards", "holeCards", []));
    const hand = evaluatePokerHand(isFiveCardDraw ? holeCards : [...holeCards, ...communityCards]);
    return {
      player,
      seatNo,
      name: pokerPlayerName(roomPlayers, player),
      folded: Boolean(get(player, "folded", "folded", false)),
      allIn: Boolean(get(player, "all_in", "allIn", false)),
      holeCards,
      hand,
      winner: winnerSeatNos.includes(seatNo),
    };
  });
  const winnerSummaries = summaries.filter((summary) => summary.winner);
  if (!winnerSummaries.length) return null;

  const sortedWinners = [...winnerSummaries].sort((left, right) => comparePokerHands(right.hand, left.hand));
  const bestWinner = sortedWinners[0];
  const opponentSummaries = summaries
    .filter((summary) => !summary.winner && !summary.folded && summary.hand.ready)
    .sort((left, right) => comparePokerHands(right.hand, left.hand));
  const bestOpponent = opponentSummaries[0] || null;
  const winnerNames = winnerSummaries.map((summary) => summary.name).join(", ");
  const potValue = Number(lastPot || pot || 0);
  const topHandText = pokerResultHandText(bestWinner);
  const title = winnerSummaries.length > 1 ? "공동 쇼다운 승리" : `${bestWinner.name} 승리`;
  const reason = (() => {
    if (winnerSummaries.length > 1) return `${winnerNames}이 ${topHandText}로 동률이라 팟을 나눠 가졌습니다.`;
    if (!bestOpponent) return `${bestWinner.name}이 ${topHandText}로 팟 ${potValue.toLocaleString("ko-KR")}칩을 가져갔습니다.`;
    const winnerRanks = pokerResultRankText(bestWinner.hand);
    const opponentRanks = pokerResultRankText(bestOpponent.hand);
    if (bestWinner.hand.category === bestOpponent.hand.category && winnerRanks && opponentRanks) {
      return `${bestWinner.name}이 같은 ${bestWinner.hand.label} 안에서 비교 카드 ${winnerRanks}로 ${bestOpponent.name}님의 ${opponentRanks}보다 앞섰습니다.`;
    }
    return `${bestWinner.name}이 ${topHandText}로 ${bestOpponent.name}님의 ${pokerResultHandText(bestOpponent)}보다 높은 족보를 만들었습니다.`;
  })();

  const items = summaries.map((summary) => {
    const handText = pokerResultHandText(summary);
    const rankText = pokerResultRankText(summary.hand);
    if (summary.winner) {
      return {
        ...summary,
        state: "winner",
        stateLabel: winnerSummaries.length > 1 ? "공동 승자" : "승자",
        handText,
        rankText,
        detail: winnerSummaries.length > 1 ? "같은 최고 족보로 팟을 분배했습니다." : reason,
      };
    }
    if (summary.folded) {
      return {
        ...summary,
        state: "folded",
        stateLabel: "폴드",
        handText: "비교 제외",
        rankText: "",
        detail: "폴드한 플레이어는 쇼다운 족보 비교에 참여하지 않습니다.",
      };
    }
    if (!summary.hand.ready) {
      return {
        ...summary,
        state: "waiting",
        stateLabel: "공개 부족",
        handText,
        rankText,
        detail: "공개 카드 정보가 부족해 로컬 비교는 서버 결과 설명을 우선합니다.",
      };
    }
    const sameCategory = bestWinner?.hand?.category === summary.hand.category;
    return {
      ...summary,
      state: "lost",
      stateLabel: sameCategory ? "비교 카드 패배" : "족보 패배",
      handText,
      rankText,
      detail: sameCategory && pokerResultRankText(bestWinner.hand) && rankText
        ? `같은 ${summary.hand.label}였지만 비교 카드가 ${pokerResultRankText(bestWinner.hand)} 대 ${rankText}로 밀렸습니다.`
        : `${bestWinner?.hand?.label || "승자 족보"}보다 낮은 ${summary.hand.label}였습니다.`,
    };
  });

  return {
    title,
    reason,
    potValue,
    winnerNames,
    topHandText,
    communityCards,
    items,
    winnerCount: winnerSummaries.length,
    foldedCount: summaries.filter((summary) => summary.folded).length,
    showdownCount: summaries.filter((summary) => !summary.folded && summary.hand.ready).length,
  };
};

const PokerShowdownTraceArt = ({ breakdown }) => {
  const items = (breakdown?.items || []).slice(0, 4);
  const nodePositions = [
    { x: 66, y: 52 },
    { x: 250, y: 52 },
    { x: 66, y: 146 },
    { x: 250, y: 146 },
  ];
  return (
    <svg
      data-smoke="poker-showdown-trace-art"
      viewBox="0 0 320 200"
      className="h-auto w-full"
      role="img"
      aria-label="포커 쇼다운 승리 근거 요약"
      focusable="false"
    >
      <rect x="8" y="8" width="304" height="184" rx="28" fill="#052e2b" stroke="#14b8a6" strokeWidth="3" />
      <ellipse cx="160" cy="100" rx="92" ry="58" fill="#065f46" stroke="#34d399" strokeWidth="5" />
      <ellipse cx="160" cy="100" rx="48" ry="28" fill="#064e3b" stroke="#a7f3d0" strokeWidth="2" opacity="0.82" />
      <circle cx="146" cy="98" r="20" fill="#fbbf24" stroke="#92400e" strokeWidth="4" />
      <circle cx="165" cy="105" r="20" fill="#fde68a" stroke="#92400e" strokeWidth="4" />
      <text x="156" y="101" textAnchor="middle" fontSize="11" fontWeight="900" fill="#78350f">POT</text>
      <text x="156" y="117" textAnchor="middle" fontSize="15" fontWeight="900" fill="#78350f">{breakdown?.potValue || 0}</text>
      {items.map((item, index) => {
        const position = nodePositions[index] || nodePositions[0];
        const winner = item.state === "winner";
        const folded = item.state === "folded";
        return (
          <g key={`${item.seatNo}-${index}`} data-smoke="poker-showdown-trace-node">
            <path d={`M${position.x} ${position.y} Q160 100 ${position.x + (position.x < 160 ? 32 : -32)} ${position.y + (position.y < 100 ? 28 : -28)}`} fill="none" stroke={winner ? "#fbbf24" : folded ? "#94a3b8" : "#67e8f9"} strokeWidth={winner ? 4 : 2.5} strokeLinecap="round" opacity={folded ? 0.55 : 0.9} />
            <circle cx={position.x} cy={position.y} r={winner ? 24 : 20} fill={winner ? "#fef3c7" : folded ? "#334155" : "#ecfeff"} stroke={winner ? "#f59e0b" : folded ? "#64748b" : "#06b6d4"} strokeWidth="4" />
            <text x={position.x} y={position.y - 2} textAnchor="middle" fontSize="13" fontWeight="900" fill={winner ? "#92400e" : folded ? "#cbd5e1" : "#0e7490"}>{item.seatNo}</text>
            <text x={position.x} y={position.y + 13} textAnchor="middle" fontSize="8" fontWeight="900" fill={winner ? "#92400e" : folded ? "#cbd5e1" : "#0e7490"}>{item.stateLabel}</text>
          </g>
        );
      })}
      <text x="28" y="29" fontSize="11" fontWeight="900" fill="#a7f3d0">쇼다운 해설</text>
      <text x="292" y="29" textAnchor="end" fontSize="10" fontWeight="900" fill="#ccfbf1">
        {breakdown?.showdownCount || 0}명 비교 · {breakdown?.foldedCount || 0}명 폴드
      </text>
    </svg>
  );
};

const PokerHiddenCardsBriefArt = ({ isFiveCardDraw = false, folded = false }) => {
  const slotCount = isFiveCardDraw ? 5 : 2;
  const accent = folded ? "#94a3b8" : "#38bdf8";
  const label = folded ? "폴드" : "비공개";
  return (
    <svg
      viewBox="0 0 220 96"
      className="h-24 w-full"
      role="img"
      aria-label={`포커 ${label} 카드 브리핑`}
      data-smoke="poker-hidden-cards-brief-art"
      focusable="false"
    >
      <rect x="8" y="8" width="204" height="80" rx="18" fill="#f8fafc" stroke={accent} strokeWidth="3" />
      <path d="M28 68 C68 28, 140 28, 180 68" fill="none" stroke={accent} strokeWidth="4" strokeLinecap="round" opacity="0.28" />
      {Array.from({ length: slotCount }, (_, index) => {
        const x = 28 + index * (slotCount === 5 ? 28 : 42);
        return (
          <g key={`hidden-card-${index}`} data-smoke="poker-hidden-cards-brief-node" data-hidden-slot={index + 1}>
            <rect x={x} y={26 + (index % 2) * 4} width="30" height="42" rx="7" fill={folded ? "#e2e8f0" : "#dbeafe"} stroke={accent} strokeWidth="2" />
            <path d={`M${x + 8} ${40 + (index % 2) * 4}h14M${x + 8} ${50 + (index % 2) * 4}h14`} stroke={folded ? "#64748b" : "#1d4ed8"} strokeWidth="2" strokeLinecap="round" opacity="0.72" />
          </g>
        );
      })}
      <g data-smoke="poker-hidden-cards-brief-node" data-hidden-slot="state">
        <circle cx="178" cy="39" r="17" fill={folded ? "#475569" : "#0f766e"} stroke="#ffffff" strokeWidth="3" />
        <text x="178" y="43" textAnchor="middle" fill="#ffffff" fontSize="10" fontWeight="900">{label}</text>
      </g>
      <text x="178" y="68" textAnchor="middle" fill="#334155" fontSize="10" fontWeight="900">{slotCount}장 기준</text>
    </svg>
  );
};

const PokerHiddenCardsBrief = ({ item, isFiveCardDraw = false }) => {
  const folded = item?.state === "folded";
  const slotText = isFiveCardDraw ? "5장 손패" : "2장 홀카드";
  const detail = folded
    ? "폴드한 플레이어의 카드는 쇼다운 비교에서 제외되어 공개되지 않습니다."
    : "서버가 카드 정보를 공개하지 않은 상태라 결과 설명과 공개된 비교 근거를 우선합니다.";
  const items = [
    { key: "cards", label: "카드 상태", value: folded ? "폴드로 비공개" : "미공개", detail: slotText },
    { key: "compare", label: "비교 여부", value: folded ? "비교 제외" : "서버 결과 우선", detail },
  ];

  return (
    <div className="w-full rounded-xl border border-dashed border-slate-200 bg-white px-3 py-2" data-smoke="poker-hidden-cards-brief" data-hidden-state={folded ? "folded" : "hidden"}>
      <PokerHiddenCardsBriefArt isFiveCardDraw={isFiveCardDraw} folded={folded} />
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {items.map((entry) => (
          <div key={entry.key} data-smoke="poker-hidden-cards-brief-item" data-hidden-key={entry.key} className="rounded-lg bg-slate-50 px-2.5 py-2">
            <div className="text-[10px] font-black text-slate-400">{entry.label}</div>
            <div className="mt-0.5 text-xs font-black text-slate-900">{entry.value}</div>
            <div className="mt-0.5 text-[11px] font-bold leading-relaxed text-slate-500">{entry.detail}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

const PokerShowdownBreakdownPanel = ({ breakdown, isFiveCardDraw = false }) => {
  if (!breakdown?.items?.length) return null;
  const communityCards = listOf(breakdown.communityCards);
  return (
    <section data-smoke="poker-showdown-breakdown-panel" className="mt-3 overflow-hidden rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50 via-white to-emerald-50 shadow-sm">
      <div className="grid gap-3 p-3 lg:grid-cols-[260px_minmax(0,1fr)]">
        <PokerShowdownTraceArt breakdown={breakdown} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="text-xs font-black text-amber-700">쇼다운 해설</div>
              <div className="mt-1 text-lg font-black text-slate-950">{breakdown.title}</div>
              <div className="mt-1 text-xs font-bold leading-relaxed text-slate-600">{breakdown.reason}</div>
            </div>
            <span className="rounded-full bg-amber-100 px-3 py-1 text-[11px] font-black text-amber-800">
              팟 {Number(breakdown.potValue || 0).toLocaleString("ko-KR")}칩
            </span>
          </div>
          {!isFiveCardDraw && communityCards.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5 rounded-xl bg-emerald-950/90 px-3 py-2">
              <span className="mr-1 text-[10px] font-black text-emerald-100">공용 카드</span>
              {communityCards.map((card, index) => <PokerCard key={`${pokerCardId(card)}-${index}`} card={card} compact />)}
            </div>
          )}
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {breakdown.items.map((item) => (
              <div key={item.seatNo} data-smoke="poker-showdown-breakdown-item" className={`rounded-xl border px-3 py-2 ${item.state === "winner" ? "border-amber-200 bg-amber-50" : item.state === "folded" ? "border-slate-200 bg-slate-50" : "border-sky-100 bg-sky-50"}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-black text-slate-950">{item.name}</div>
                    <div className="mt-0.5 text-[10px] font-black text-slate-500">좌석 {item.seatNo} · {item.stateLabel}</div>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${item.state === "winner" ? "bg-amber-200 text-amber-900" : item.state === "folded" ? "bg-slate-200 text-slate-600" : "bg-white text-sky-700"}`}>
                    {item.handText}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {item.holeCards.slice(0, isFiveCardDraw ? 5 : 2).map((card, index) => (
                    <PokerCard key={`${item.seatNo}-${pokerCardId(card)}-${index}`} card={card} compact />
                  ))}
                  {!item.holeCards.length && <PokerHiddenCardsBrief item={item} isFiveCardDraw={isFiveCardDraw} />}
                </div>
                <div className="mt-2 text-[11px] font-bold leading-relaxed text-slate-600">
                  {item.detail}
                  {item.rankText ? ` 비교 카드: ${item.rankText}` : ""}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

const PokerCommunityStandbyArt = ({ isFiveCardDraw = false, maxDrawCards = 3, phaseLabel = "" }) => {
  const nodes = isFiveCardDraw
    ? [
      { key: "private", label: "5장", x: 62, y: 70, active: true },
      { key: "draw", label: "교체", x: 134, y: 44, active: true },
      { key: "showdown", label: "비교", x: 214, y: 70, active: false },
      { key: "pot", label: "팟", x: 282, y: 46, active: false },
    ]
    : [
      { key: "preflop", label: "프리", x: 62, y: 70, active: true },
      { key: "flop", label: "플랍", x: 134, y: 44, active: false },
      { key: "turn", label: "턴", x: 214, y: 70, active: false },
      { key: "river", label: "리버", x: 282, y: 46, active: false },
    ];

  return (
    <svg
      data-smoke="poker-community-standby-art"
      viewBox="0 0 340 150"
      className="h-auto w-full"
      role="img"
      aria-label={isFiveCardDraw ? "포커 공용 카드가 없는 Five-card Draw 흐름" : "포커 공용 카드 공개 대기 흐름"}
      focusable="false"
    >
      <rect x="8" y="8" width="324" height="134" rx="24" fill="#052e2b" stroke="#34d399" strokeWidth="3" />
      <ellipse cx="170" cy="83" rx="118" ry="48" fill="#065f46" stroke="#a7f3d0" strokeWidth="3" opacity="0.9" />
      <path d="M60 96C100 62 145 62 176 88C209 116 254 102 302 50" fill="none" stroke="#5eead4" strokeWidth="4" strokeLinecap="round" opacity="0.48" />
      {nodes.map((node, index) => (
        <g key={node.key} data-smoke="poker-community-standby-node" data-community-key={node.key}>
          {index > 0 && (
            <path
              d={`M${nodes[index - 1].x + 20} ${nodes[index - 1].y} C${nodes[index - 1].x + 42} ${nodes[index - 1].y - 20} ${node.x - 42} ${node.y - 20} ${node.x - 20} ${node.y}`}
              fill="none"
              stroke={node.active ? "#fbbf24" : "#94a3b8"}
              strokeWidth="3"
              strokeLinecap="round"
              opacity={node.active ? 0.82 : 0.42}
            />
          )}
          <circle cx={node.x} cy={node.y} r="21" fill={node.active ? "#fef3c7" : "#134e4a"} stroke={node.active ? "#f59e0b" : "#5eead4"} strokeWidth="4" />
          <text x={node.x} y={node.y + 4} textAnchor="middle" fontSize="10" fontWeight="900" fill={node.active ? "#92400e" : "#ccfbf1"}>{node.label}</text>
        </g>
      ))}
      <rect x="24" y="20" width="106" height="22" rx="11" fill="#ecfeff" />
      <text x="77" y="35" textAnchor="middle" fontSize="10" fontWeight="900" fill="#0f766e">{isFiveCardDraw ? "공용 카드 없음" : "공개 대기"}</text>
      <rect x="190" y="116" width="108" height="18" rx="9" fill="#022c22" stroke="#14b8a6" />
      <text x="244" y="129" textAnchor="middle" fontSize="9" fontWeight="900" fill="#ccfbf1">{isFiveCardDraw ? `최대 ${maxDrawCards}장 교체` : phaseLabel || "프리플랍"}</text>
    </svg>
  );
};

const PokerCommunityStandbyPanel = ({ isFiveCardDraw = false, maxDrawCards = 3, phaseLabel = "", myCards = [], communityCards = [] }) => {
  const visibleCount = myCards.length + communityCards.length;
  const items = isFiveCardDraw
    ? [
      { key: "board", label: "중앙 카드", value: "없음", detail: "Five-card Draw는 공용 카드가 열리지 않고 각자의 손패만으로 승부를 봅니다." },
      { key: "private", label: "판단 기준", value: `${myCards.length || 0}장 손패`, detail: "내 카드 조합과 교체 후보가 핵심 정보입니다." },
      { key: "draw", label: "다음 행동", value: `최대 ${maxDrawCards}장 교체`, detail: "교체 단계에서는 약한 카드만 골라 현재 족보를 보강합니다." },
      { key: "result", label: "결과 비교", value: "쇼다운", detail: "교체 후 최종 5장 족보를 비교해 팟을 정산합니다." },
    ]
    : [
      { key: "board", label: "중앙 카드", value: "공개 대기", detail: "플랍 전에는 공용 카드가 아직 열리지 않습니다." },
      { key: "private", label: "판단 기준", value: `${visibleCount}장 정보`, detail: "내 홀카드와 팟 비용으로 첫 결정을 잡습니다." },
      { key: "street", label: "다음 공개", value: phaseLabel || "플랍", detail: "다음 거리에서 공용 카드가 열리면 족보 강도가 다시 계산됩니다." },
      { key: "result", label: "결과 비교", value: "최고 5장", detail: "홀카드와 공용 카드 중 가장 강한 5장 조합을 비교합니다." },
    ];

  return (
    <div
      className="w-full max-w-3xl rounded-2xl border border-emerald-200/30 bg-zinc-950/45 p-3 text-left"
      data-smoke="poker-community-standby-panel"
      data-community-mode={isFiveCardDraw ? "five-card-draw" : "holdem"}
      data-phase-label={phaseLabel || ""}
    >
      <div className="grid gap-3 lg:grid-cols-[220px_minmax(0,1fr)] lg:items-center">
        <PokerCommunityStandbyArt isFiveCardDraw={isFiveCardDraw} maxDrawCards={maxDrawCards} phaseLabel={phaseLabel} />
        <div className="min-w-0">
          <div className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-[10px] font-black text-emerald-800">공용 카드 브리핑</div>
          <div className="mt-2 text-sm font-black text-white">{isFiveCardDraw ? "공용 카드가 없습니다" : "아직 공용 카드가 열리지 않았습니다"}</div>
          <div className="mt-1 text-xs font-bold leading-relaxed text-emerald-100/85">
            {isFiveCardDraw
              ? "이 변형은 중앙 공개 카드 대신 각자 받은 5장과 교체 선택으로 승부를 봅니다. 중앙이 비어 있는 것은 오류가 아니라 규칙에 맞는 상태입니다."
              : "프리플랍 구간에서는 중앙 카드가 비어 있습니다. 다음 공개 전까지 홀카드, 팟 비용, 상대 행동을 먼저 읽으세요."}
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {items.map((item) => (
              <div key={item.key} data-smoke="poker-community-standby-item" data-community-key={item.key} className="rounded-xl border border-white/10 bg-white/10 px-3 py-2">
                <div className="text-[10px] font-black text-emerald-100/65">{item.label}</div>
                <div className="mt-1 text-xs font-black text-white">{item.value}</div>
                <div className="mt-1 text-[11px] font-bold leading-relaxed text-emerald-100/75">{item.detail}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const pokerActionRouteTone = {
  fold: { fill: "#fff1f2", stroke: "#e11d48", text: "#be123c", soft: "#fecdd3" },
  call: { fill: "#ecfdf5", stroke: "#059669", text: "#047857", soft: "#bbf7d0" },
  raise: { fill: "#fffbeb", stroke: "#f59e0b", text: "#b45309", soft: "#fde68a" },
  draw: { fill: "#eff6ff", stroke: "#3b82f6", text: "#1d4ed8", soft: "#bfdbfe" },
  locked: { fill: "#f8fafc", stroke: "#94a3b8", text: "#475569", soft: "#e2e8f0" },
  result: { fill: "#fef3c7", stroke: "#d97706", text: "#92400e", soft: "#fde68a" },
};

const buildPokerActionRouteItems = ({
  phase = "",
  phaseLabel = "",
  myTurn = false,
  isFiveCardDraw = false,
  isFinished = false,
  callAmount = 0,
  fixedBet = 0,
  pot = 0,
  lastPot = 0,
  potOddsText = "0%",
  availableActions = [],
  drawSelection = [],
  maxDrawCards = 3,
  canSubmitDraw = false,
  resultMessage = "",
  activePlayerName = "",
  handInfo = null,
}) => {
  const normalizedActions = listOf(availableActions).map((action) => String(action || "").toUpperCase());
  const explicitActions = normalizedActions.length > 0;
  const actionSet = new Set(normalizedActions);
  const callCost = Number(callAmount || 0);
  const raiseStep = Number(fixedBet || 0);
  const currentPot = Number(pot || lastPot || 0);
  const isDrawPhase = phase === "DRAW";
  const checkCallAction = callCost > 0 ? "CALL" : "CHECK";
  const turnOwner = activePlayerName || "상대";
  const actionAllowed = (action) => myTurn && !isFinished && !isDrawPhase && (!explicitActions || actionSet.has(action));
  const drawAllowed = myTurn && !isFinished && isDrawPhase && canSubmitDraw;
  const lockedDetail = isFinished
    ? "핸드가 끝나 현재 버튼은 결과 확인 흐름으로 전환됩니다."
    : isDrawPhase
      ? "카드 교체 단계에서는 베팅 버튼 대신 교체 제출을 사용합니다."
      : myTurn
        ? "서버가 내려준 가능 액션 기준으로 버튼 상태를 읽습니다."
        : `${turnOwner} 차례라 내 액션 버튼은 잠겨 있습니다.`;

  return [
    {
      key: "fold",
      label: "폴드",
      value: actionAllowed("FOLD") ? "가능" : "잠김",
      artValue: actionAllowed("FOLD") ? "가능" : "잠김",
      detail: actionAllowed("FOLD")
        ? `이번 팟 ${currentPot}칩을 포기하고 추가 손실을 막는 선택입니다.`
        : lockedDetail,
      toneKey: actionAllowed("FOLD") ? "fold" : "locked",
      tone: actionAllowed("FOLD") ? "border-rose-100 bg-rose-50 text-rose-800" : "border-slate-100 bg-slate-50 text-slate-700",
    },
    {
      key: "check-call",
      label: callCost > 0 ? "콜" : "체크",
      value: actionAllowed(checkCallAction) ? (callCost > 0 ? `${callCost}칩` : "무료") : "잠김",
      artValue: actionAllowed(checkCallAction) ? (callCost > 0 ? `${callCost}` : "무료") : "잠김",
      detail: actionAllowed(checkCallAction)
        ? callCost > 0
          ? `콜 비용은 ${callCost}칩, 팟오즈는 ${potOddsText}입니다. 현재 패 강도와 비교하세요.`
          : "비용 없이 다음 공개 카드나 상대 반응을 볼 수 있는 선택입니다."
        : lockedDetail,
      toneKey: actionAllowed(checkCallAction) ? "call" : "locked",
      tone: actionAllowed(checkCallAction) ? "border-emerald-100 bg-emerald-50 text-emerald-800" : "border-slate-100 bg-slate-50 text-slate-700",
    },
    {
      key: "raise",
      label: "레이즈",
      value: actionAllowed("RAISE") ? `+${raiseStep}칩` : "잠김",
      artValue: actionAllowed("RAISE") ? `+${raiseStep}` : "잠김",
      detail: actionAllowed("RAISE")
        ? `고정 레이즈 단위 ${raiseStep}칩으로 팟 압박을 올립니다.`
        : lockedDetail,
      toneKey: actionAllowed("RAISE") ? "raise" : "locked",
      tone: actionAllowed("RAISE") ? "border-amber-100 bg-amber-50 text-amber-800" : "border-slate-100 bg-slate-50 text-slate-700",
    },
    {
      key: "draw",
      label: isFiveCardDraw ? "카드 교체" : "공개/정산",
      value: isFinished ? "결과 확인" : isDrawPhase ? `${drawSelection.length}/${maxDrawCards}` : isFiveCardDraw ? "교체 대기" : phaseLabel,
      artValue: isFinished ? "결과" : isDrawPhase ? `${drawSelection.length}/${maxDrawCards}` : isFiveCardDraw ? "대기" : "공개",
      detail: isFinished
        ? (resultMessage || `${handInfo?.label || "최종 패"} 기준으로 승부 근거를 확인합니다.`)
        : isDrawPhase
          ? drawAllowed
            ? `${drawSelection.length}장을 교체 제출할 수 있습니다. 선택하지 않으면 현재 패를 유지합니다.`
            : `최대 ${maxDrawCards}장까지만 교체할 수 있습니다.`
          : isFiveCardDraw
            ? "베팅 뒤 교체 단계가 오면 손패에서 바꿀 카드를 고릅니다."
            : "커뮤니티 카드 공개와 베팅 라운드가 이어지는 구간입니다.",
      toneKey: isFinished ? "result" : isDrawPhase ? "draw" : "locked",
      tone: isFinished ? "border-amber-100 bg-amber-50 text-amber-800" : isDrawPhase ? "border-sky-100 bg-sky-50 text-sky-800" : "border-indigo-100 bg-indigo-50 text-indigo-800",
    },
  ];
};

const PokerActionRouteArt = ({
  phase = "",
  phaseLabel = "",
  myTurn = false,
  callAmount = 0,
  drawSelectionCount = 0,
  maxDrawCards = 3,
  isFinished = false,
  items = [],
}) => {
  const routeItems = items.length ? items : [
    { key: "fold", label: "폴드", artValue: "-" },
    { key: "check-call", label: Number(callAmount || 0) > 0 ? "콜" : "체크", artValue: "-" },
    { key: "raise", label: "레이즈", artValue: "-" },
    { key: "draw", label: "교체", artValue: `${drawSelectionCount}/${maxDrawCards}` },
  ];
  const activeIndex = isFinished ? 3 : phase === "DRAW" ? 3 : myTurn ? 1 : 0;

  return (
    <svg
      viewBox="0 0 400 150"
      className="h-full min-h-[124px] w-full"
      role="img"
      aria-label="포커 액션 루트"
      data-smoke="poker-action-route-art"
      focusable="false"
    >
      <rect x="10" y="10" width="380" height="130" rx="24" fill="#f8fafc" stroke="#d1fae5" strokeWidth="3" />
      <path d="M58 75h284" stroke="#d1fae5" strokeWidth="14" strokeLinecap="round" />
      <path d="M58 75h284" stroke={myTurn ? "#059669" : "#94a3b8"} strokeWidth="4" strokeLinecap="round" opacity="0.72" />
      {routeItems.map((item, index) => {
        const x = 58 + index * 94.6;
        const tone = pokerActionRouteTone[item.toneKey] || pokerActionRouteTone.locked;
        const active = index === activeIndex;
        return (
          <g key={item.key} data-smoke="poker-action-route-node" data-route-key={item.key}>
            <circle cx={x} cy="75" r={active ? 34 : 31} fill="#ffffff" stroke={tone.stroke} strokeWidth={active ? "5" : "4"} />
            <circle cx={x} cy="75" r="22" fill={tone.fill} stroke="#ffffff" strokeWidth="3" />
            <text x={x} y="70" textAnchor="middle" fontSize="9" fontWeight="900" fill={tone.text}>{item.label}</text>
            <text x={x} y="89" textAnchor="middle" fontSize="13" fontWeight="900" fill={tone.text}>{item.artValue}</text>
          </g>
        );
      })}
      <rect x="64" y="116" width="272" height="18" rx="9" fill="#ffffff" stroke="#bbf7d0" />
      <text x="200" y="129" textAnchor="middle" fontSize="10" fontWeight="900" fill="#047857">
        폴드 → 체크/콜 → 레이즈 → 교체/정산
      </text>
      <text x="30" y="28" fontSize="10" fontWeight="900" fill="#047857">{phaseLabel || phase || "포커"}</text>
    </svg>
  );
};

const PokerActionRoutePanel = ({
  phase = "",
  phaseLabel = "",
  myTurn = false,
  isFiveCardDraw = false,
  isFinished = false,
  callAmount = 0,
  fixedBet = 0,
  pot = 0,
  lastPot = 0,
  potOddsText = "0%",
  availableActions = [],
  drawSelection = [],
  maxDrawCards = 3,
  canSubmitDraw = false,
  resultMessage = "",
  activePlayerName = "",
  handInfo = null,
}) => {
  const normalizedActions = listOf(availableActions).map((action) => String(action || "").toUpperCase());
  const items = buildPokerActionRouteItems({
    phase,
    phaseLabel,
    myTurn,
    isFiveCardDraw,
    isFinished,
    callAmount,
    fixedBet,
    pot,
    lastPot,
    potOddsText,
    availableActions: normalizedActions,
    drawSelection,
    maxDrawCards,
    canSubmitDraw,
    resultMessage,
    activePlayerName,
    handInfo,
  });

  return (
    <section
      data-smoke="poker-action-route-panel"
      data-phase={phase || ""}
      data-my-turn={myTurn ? "true" : "false"}
      data-call-amount={Number(callAmount || 0)}
      data-draw-count={drawSelection.length}
      data-available-actions={normalizedActions.join(",")}
      className="mt-3 overflow-hidden rounded-2xl border border-emerald-100 bg-gradient-to-br from-white via-emerald-50 to-sky-50 p-3 shadow-sm sm:rounded-[1.5rem] sm:p-4"
    >
      <div className="grid gap-3 lg:grid-cols-[minmax(220px,0.82fr)_minmax(0,1fr)] lg:items-center">
        <div className="min-h-[132px]">
          <PokerActionRouteArt
            phase={phase}
            phaseLabel={phaseLabel}
            myTurn={myTurn}
            callAmount={callAmount}
            drawSelectionCount={drawSelection.length}
            maxDrawCards={maxDrawCards}
            isFinished={isFinished}
            items={items}
          />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="text-[11px] font-black text-emerald-700">포커 액션 루트</div>
              <h3 className="text-base font-black text-slate-900">누를 버튼과 잠긴 이유</h3>
            </div>
            <div className="rounded-full border border-emerald-100 bg-white px-3 py-1 text-[11px] font-black text-emerald-700">
              {isFinished ? "결과 확인" : myTurn ? "내 차례" : `${activePlayerName || "상대"} 차례`}
            </div>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {items.map((item) => (
              <div key={item.key} data-smoke="poker-action-route-item" data-route-key={item.key} className={`min-h-[102px] rounded-xl border px-3 py-2.5 ${item.tone}`}>
                <div className="text-[10px] font-black opacity-70">{item.label}</div>
                <div className="mt-0.5 text-sm font-black leading-snug">{item.value}</div>
                <div className="mt-1 text-[11px] font-bold leading-relaxed opacity-80">{item.detail}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export const PokerBoard = ({ gameState, players: roomPlayers = [], mySeatNo, onAction }) => {
  const [drawSelection, setDrawSelection] = useState([]);
  const phase = get(gameState, "phase", "phase", "");
  const variantCode = String(get(gameState, "variant_code", "variantCode", "") || "").toUpperCase();
  const mode = String(get(gameState, "mode", "mode", "") || "").toUpperCase();
  const isFiveCardDraw = mode === "FIVE_CARD_DRAW" || variantCode === "FIVE_CARD_DRAW";
  const pokerPlayers = listOf(get(gameState, "players", "players", []));
  const communityCards = listOf(get(gameState, "community_cards", "communityCards", []));
  const activeSeatNo = Number(get(gameState, "active_seat_no", "activeSeatNo", 0));
  const dealerSeatNo = Number(get(gameState, "dealer_seat_no", "dealerSeatNo", 0));
  const ante = Number(get(gameState, "ante", "ante", 0));
  const smallBlind = Number(get(gameState, "small_blind", "smallBlind", 0));
  const bigBlind = Number(get(gameState, "big_blind", "bigBlind", 0));
  const maxDrawCards = Number(get(gameState, "max_draw_cards", "maxDrawCards", 3)) || 3;
  const handNo = Number(get(gameState, "hand_no", "handNo", 0));
  const maxHands = Number(get(gameState, "max_hands", "maxHands", 0));
  const pot = Number(get(gameState, "pot", "pot", 0));
  const lastPot = Number(get(gameState, "last_pot", "lastPot", 0));
  const winnerSeatNo = Number(get(gameState, "winner_seat_no", "winnerSeatNo", 0));
  const callAmount = Number(get(gameState, "call_amount", "callAmount", 0));
  const fixedBet = Number(get(gameState, "fixed_bet", "fixedBet", bigBlind));
  const availableActions = listOf(get(gameState, "available_actions", "availableActions", []));
  const events = listOf(get(gameState, "events", "events", []));
  const myPlayer = pokerPlayers.find((player) => Number(get(player, "seat_no", "seatNo", 0)) === Number(mySeatNo));
  const myCards = listOf(get(myPlayer, "hole_cards", "holeCards", []));
  const myTurn = (isBettingPokerPhase(phase) || phase === "DRAW") && activeSeatNo === Number(mySeatNo);
  const phaseLabel = pokerPhaseLabels[phase] || phase || "-";
  const potOddsText = callAmount > 0 ? `${Math.round((callAmount / Math.max(1, pot + callAmount)) * 100)}%` : "0%";
  const handInfo = evaluatePokerHand(isFiveCardDraw ? myCards : [...myCards, ...communityCards]);
  const drawHelp = isFiveCardDraw ? drawPokerAdvice(myCards) : { message: "", suggestedIds: [] };
  const myCardKey = myCards.map(pokerCardId).join("|");
  const winnerName = winnerSeatNo ? pokerPlayerName(roomPlayers, pokerPlayers.find((player) => Number(get(player, "seat_no", "seatNo", 0)) === winnerSeatNo) || {}) : "";
  const resultTitle = get(gameState, "result_title", "resultTitle", "");
  const resultDetail = get(gameState, "result_detail", "resultDetail", "");
  const resultEvent = events
    .slice()
    .reverse()
    .find((event) => ["SHOWDOWN", "POT_AWARDED", "GAME_FINISHED"].includes(get(event, "event_type", "eventType", "")));
  const pokerResultExplanation = buildPokerResultExplanation({ gameState, pokerPlayers, roomPlayers, communityCards, isFiveCardDraw, winnerSeatNo, lastPot, pot });
  const resultMessage = resultDetail || pokerResultExplanation || get(resultEvent, "message", "message", "");
  const pokerShowdownBreakdown = (phase === "HAND_FINISHED" || phase === "FINISHED")
    ? buildPokerShowdownBreakdown({ gameState, pokerPlayers, roomPlayers, communityCards, isFiveCardDraw, winnerSeatNo, lastPot, pot })
    : null;
  const resultHeading = resultTitle || (phase === "FINISHED" ? (winnerName ? `${winnerName} 최종 승리` : "최종 결과") : phase === "HAND_FINISHED" ? "핸드 결과" : "");
  const canUse = (action) => myTurn && (!availableActions.length || availableActions.includes(action));
  const send = (actionType, extra = {}) => onAction({ actionType, ...extra });
  const holeCardSlots = isFiveCardDraw ? 5 : 2;
  const canSubmitDraw = myTurn && phase === "DRAW" && drawSelection.length <= maxDrawCards;

  useEffect(() => {
    setDrawSelection([]);
  }, [phase, myCardKey]);

  const toggleDrawCard = (card) => {
    const cardId = pokerCardId(card);
    if (!cardId || !myTurn || phase !== "DRAW") return;
    setDrawSelection((prev) => {
      if (prev.includes(cardId)) return prev.filter((id) => id !== cardId);
      if (prev.length >= maxDrawCards) return prev;
      return [...prev, cardId];
    });
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
      <main className="space-y-4">
        <section id="poker-table-panel" className="scroll-mt-24 overflow-hidden rounded-[1.5rem] border border-emerald-900 bg-zinc-950 p-3 text-white shadow-2xl sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-300">{isFiveCardDraw ? "Five-card Draw" : "Texas Hold'em"}</div>
              <h2 className="mt-1 text-xl font-black">포커 테이블</h2>
              <div className="mt-1 text-xs font-bold text-emerald-100/80">
                {phaseLabel} · {isFiveCardDraw ? `앤티 ${ante} · 베팅 단위 ${bigBlind}` : `블라인드 ${smallBlind}/${bigBlind}`}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-right">
              <div className="rounded-2xl bg-white/10 px-3 py-2">
                <div className="text-[10px] font-black text-emerald-100/70">POT</div>
                <div className="text-lg font-black">{pot || lastPot}</div>
              </div>
              <div className="rounded-2xl bg-white/10 px-3 py-2">
                <div className="text-[10px] font-black text-emerald-100/70">현재 순번</div>
                <div className="text-lg font-black">{activeSeatNo ? `${activeSeatNo}번` : "-"}</div>
              </div>
            </div>
          </div>

          <div className="relative mt-4 rounded-[2rem] border border-amber-200/20 bg-gradient-to-br from-emerald-800 via-emerald-700 to-emerald-950 p-4 shadow-inner">
            <div className="flex min-h-28 flex-wrap items-center justify-center gap-2">
              {isFiveCardDraw ? (
                <PokerCommunityStandbyPanel
                  isFiveCardDraw
                  maxDrawCards={maxDrawCards}
                  phaseLabel={phaseLabel}
                  myCards={myCards}
                  communityCards={communityCards}
                />
              ) : (
                Array.from({ length: 5 }, (_, index) => (
                  <PokerCard key={index} card={communityCards[index]} hidden={!communityCards[index]} />
                ))
              )}
            </div>
            <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {pokerPlayers.map((player) => {
                const seatNo = Number(get(player, "seat_no", "seatNo", 0));
                const isActive = activeSeatNo === seatNo;
                const folded = Boolean(get(player, "folded", "folded", false));
                const allIn = Boolean(get(player, "all_in", "allIn", false));
                const bot = Boolean(get(player, "bot", "bot", false));
                const holeCards = listOf(get(player, "hole_cards", "holeCards", []));
                const levelMeta = bot ? {} : pokerPlayerLevelMeta(roomPlayers, player);
                return (
                  <div key={seatNo} className={`rounded-2xl border px-3 py-2 ${isActive ? "border-amber-300 bg-white text-slate-900" : "border-white/10 bg-zinc-950/45 text-white"} ${folded ? "opacity-55" : ""}`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <UserAvatar
                          name={pokerPlayerName(roomPlayers, player)}
                          profileUrl={bot ? "" : pokerPlayerProfileUrl(roomPlayers, player)}
                          level={levelMeta.level}
                          rewardTier={levelMeta.rewardTier}
                          frameCode={levelMeta.frameCode}
                          size="xs"
                        />
                        <div className="min-w-0">
                        <div className="truncate text-sm font-black">{pokerPlayerName(roomPlayers, player)}</div>
                        <div className="text-[11px] font-bold opacity-70">좌석 {seatNo}{seatNo === dealerSeatNo ? " · 딜러" : ""}</div>
                        </div>
                      </div>
                      {bot ? <Bot className="h-4 w-4 shrink-0" /> : <Crown className="h-4 w-4 shrink-0 text-amber-400" />}
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <div className={`flex flex-wrap gap-1 ${isFiveCardDraw ? "max-w-[14.5rem]" : ""}`}>
                        {Array.from({ length: holeCardSlots }, (_, index) => {
                          const card = holeCards[index];
                          const cardId = pokerCardId(card);
                          const selectable = Boolean(card) && phase === "DRAW" && myTurn && seatNo === Number(mySeatNo);
                          const selected = drawSelection.includes(cardId);
                          const suggested = drawHelp.suggestedIds.includes(cardId);
                          if (!selectable) {
                            return <PokerCard key={index} card={card} hidden={!card} compact selected={selected} suggested={suggested} />;
                          }
                          return (
                            <button
                              key={cardId || index}
                              type="button"
                              className="rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-300"
                              onClick={() => toggleDrawCard(card)}
                              aria-label={`${pokerCardRank(card)} ${playingCardSuitLabel(pokerCardSuit(card))} ${selected ? "교체 선택 해제" : "교체 선택"}`}
                            >
                              <PokerCard card={card} compact selected={selected} suggested={suggested} />
                            </button>
                          );
                        })}
                      </div>
                      <div className="text-right text-xs font-black">
                        <div>{Number(get(player, "chips", "chips", 0))}칩</div>
                        {!!Number(get(player, "current_bet", "currentBet", 0)) && <div className="text-amber-300">베팅 {get(player, "current_bet", "currentBet", 0)}</div>}
                        {folded && <div className="text-rose-300">폴드</div>}
                        {allIn && <div className="text-sky-300">올인</div>}
                      </div>
                    </div>
                    {get(player, "hand_rank_label", "handRankLabel", "") && (
                      <div className="mt-2 rounded-full bg-white/10 px-2 py-1 text-center text-[11px] font-black">{get(player, "hand_rank_label", "handRankLabel", "")}</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section id="poker-action-panel" className="tabletop-mobile-action-strip sticky bottom-3 z-20 scroll-mt-24 rounded-[1.5rem] border border-slate-200 bg-white/95 p-4 shadow-xl backdrop-blur xl:static xl:bg-white">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-sm font-black text-slate-900">{phase === "FINISHED" ? "최종 결과" : phase === "HAND_FINISHED" ? "핸드 결과" : myTurn ? "내 차례" : "대기 중"}</div>
              <div className="mt-1 text-xs font-bold leading-relaxed text-slate-500">
                {phase === "FINISHED" || phase === "HAND_FINISHED" ? (resultHeading || `팟 ${lastPot}칩 정산 완료`) : phase === "DRAW" && myTurn ? `교체 카드 ${drawSelection.length}/${maxDrawCards}장 선택` : myTurn ? `콜 ${callAmount}칩 · 팟오즈 ${potOddsText}` : `${activeSeatNo || "-"}번 차례를 기다리는 중`}
              </div>
            </div>
            <div className="grid min-w-[220px] flex-1 gap-2 sm:grid-cols-2">
              <div className={`rounded-xl px-3 py-2 text-xs font-black leading-relaxed ${pokerHandTone(handInfo.category)}`}>
                <div className="text-[10px] opacity-70">내 족보</div>
                <div>{handInfo.ready ? `${handInfo.label}${handInfo.summary ? ` · ${handInfo.summary}` : ""}` : handInfo.summary}</div>
              </div>
              <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs font-black leading-relaxed text-slate-700">
                <div className="text-[10px] opacity-70">현재 비용</div>
                <div>{phase === "DRAW" ? `교체 ${drawSelection.length}/${maxDrawCards}장 선택` : callAmount > 0 ? `콜 ${callAmount}칩 · 팟오즈 ${potOddsText}` : `팟 ${pot || lastPot || 0}칩`}</div>
              </div>
            </div>
          </div>

          {(phase === "HAND_FINISHED" || phase === "FINISHED") && resultMessage && (
            <GameResultSpotlight
              title={resultHeading || "핸드 결과"}
              subtitle="승리 사유"
              detail={resultMessage}
              metric={`팟 ${lastPot || pot}칩`}
              tone="amber"
              smoke="poker-result-explanation"
              className="mt-3"
            />
          )}
          {(phase === "HAND_FINISHED" || phase === "FINISHED") && pokerShowdownBreakdown && (
            <PokerShowdownBreakdownPanel breakdown={pokerShowdownBreakdown} isFiveCardDraw={isFiveCardDraw} />
          )}

          {phase === "HAND_FINISHED" ? (
            <button type="button" onClick={() => send("NEXT_HAND")} className="mt-3 min-h-12 w-full rounded-xl bg-slate-900 px-4 text-sm font-black text-white">
              다음 핸드
            </button>
          ) : phase === "FINISHED" ? (
            <div className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm font-black text-amber-700">게임이 종료되었습니다. 다시 하기는 방장 메뉴에서 진행하세요.</div>
          ) : phase === "DRAW" ? (
            <div className="mt-3 space-y-2">
              {myTurn ? (
                <>
                  <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold leading-relaxed text-slate-600">
                    교체할 카드를 손패에서 누르세요. 최대 {maxDrawCards}장까지 바꿀 수 있고, 아무 카드도 고르지 않으면 현재 5장을 유지합니다.
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <button
                      type="button"
                      disabled={!drawHelp.suggestedIds.length}
                      onClick={() => setDrawSelection(drawHelp.suggestedIds.slice(0, maxDrawCards))}
                      className="min-h-11 rounded-xl bg-amber-50 px-3 text-sm font-black text-amber-700 disabled:opacity-40"
                    >
                      추천 카드 선택
                    </button>
                    <button
                      type="button"
                      onClick={() => send("DRAW_CARDS", { cardIds: [] })}
                      className="min-h-11 rounded-xl bg-slate-100 px-3 text-sm font-black text-slate-700"
                    >
                      교체 없이 유지
                    </button>
                    <button
                      type="button"
                      disabled={!canSubmitDraw}
                      onClick={() => send("DRAW_CARDS", { cardIds: drawSelection })}
                      className="min-h-11 rounded-xl bg-slate-900 px-3 text-sm font-black text-white disabled:opacity-40"
                    >
                      선택 카드 교체
                    </button>
                  </div>
                </>
              ) : (
                <div className="rounded-xl bg-slate-50 px-3 py-2 text-sm font-black text-slate-600">
                  {activeSeatNo || "-"}번 플레이어가 교체할 카드를 고르는 중입니다.
                </div>
              )}
            </div>
          ) : (
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <button type="button" disabled={!canUse("FOLD")} onClick={() => send("FOLD")} className="min-h-11 rounded-xl bg-rose-50 px-3 text-sm font-black text-rose-700 disabled:opacity-40">폴드</button>
              <button type="button" disabled={!canUse(callAmount > 0 ? "CALL" : "CHECK")} onClick={() => send(callAmount > 0 ? "CALL" : "CHECK")} className="min-h-11 rounded-xl bg-slate-900 px-3 text-sm font-black text-white disabled:opacity-40">
                {callAmount > 0 ? `콜 ${callAmount}` : "체크"}
              </button>
              <button type="button" disabled={!canUse("RAISE")} onClick={() => send("RAISE")} className="min-h-11 rounded-xl bg-amber-500 px-3 text-sm font-black text-white disabled:opacity-40">레이즈 +{fixedBet}</button>
              <button type="button" disabled={!canUse("ALL_IN")} onClick={() => send("ALL_IN")} className="min-h-11 rounded-xl bg-zinc-800 px-3 text-sm font-black text-white disabled:opacity-40">올인</button>
            </div>
          )}
        </section>
      </main>

      <aside id="poker-players-panel" className="scroll-mt-24 space-y-4">
        <div className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-lg">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-black text-slate-900">
              <CircleDollarSign className="h-4 w-4 text-emerald-600" />
              칩 현황
            </div>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-black text-slate-600">
              핸드 {handNo || "-"} / {maxHands || "-"}
            </span>
          </div>
          <div className="space-y-2">
            {pokerPlayers.map((player) => {
              const seatNo = Number(get(player, "seat_no", "seatNo", 0));
              const bot = Boolean(get(player, "bot", "bot", false));
              const levelMeta = bot ? {} : pokerPlayerLevelMeta(roomPlayers, player);
              return (
                <div key={seatNo} className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2 ${seatNo === activeSeatNo ? "border-amber-200 bg-amber-50" : "border-slate-100 bg-slate-50"}`}>
                  <div className="flex min-w-0 items-center gap-2">
                    <UserAvatar
                      name={pokerPlayerName(roomPlayers, player)}
                      profileUrl={bot ? "" : pokerPlayerProfileUrl(roomPlayers, player)}
                      level={levelMeta.level}
                      rewardTier={levelMeta.rewardTier}
                      frameCode={levelMeta.frameCode}
                      size="xs"
                    />
                    <div className="min-w-0">
                    <div className="truncate text-sm font-black text-slate-900">{pokerPlayerName(roomPlayers, player)}</div>
                    <div className="text-[11px] font-bold text-slate-500">좌석 {seatNo}{bot ? " · AI" : ""}</div>
                    </div>
                  </div>
                  <div className="text-right text-sm font-black text-slate-900">{Number(get(player, "chips", "chips", 0))}칩</div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-lg">
          <div className="mb-3 text-sm font-black text-slate-900">최근 진행</div>
          <div className="space-y-2">
            {events.slice(-6).reverse().map((event) => (
              <div key={get(event, "event_no", "eventNo", 0)} className="rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold leading-relaxed text-slate-600">
                {get(event, "message", "message", get(event, "event_type", "eventType", ""))}
              </div>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
};

const isBettingPokerPhase = (phase) => ["OPENING_BET", "PREFLOP", "FLOP", "TURN", "RIVER", "FINAL_BET"].includes(phase);


export default PokerBoard;
