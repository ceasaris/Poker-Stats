"""Hand evaluation and exact equity calculation for Texas Hold'em after the flop."""
from collections import Counter
import random
from itertools import combinations

RANKS = "23456789TJQKA"
SUITS = "cdhs"
DECK = [r + s for r in RANKS for s in SUITS]


def parse_card(text):
    """Normalize a card string like '10h', 'As', 'kd' to 'Th', 'As', 'Kd'."""
    t = text.strip().replace("10", "T")
    if len(t) != 2:
        raise ValueError(f"Invalid card: {text!r}")
    card = t[0].upper() + t[1].lower()
    if card not in DECK:
        raise ValueError(f"Invalid card: {text!r}")
    return card


def _straight_high(rank_set):
    """Highest straight top-card in a set of rank values (2..14), or None."""
    for high in range(14, 4, -1):
        need = range(high - 4, high + 1) if high > 5 else (14, 2, 3, 4, 5)
        if all(r in rank_set for r in need):
            return high
    return None


def evaluate7(cards):
    """Return a comparable tuple; higher is better. cards: 7 card strings."""
    by_suit = {}
    counts = Counter()
    for c in cards:
        v = RANKS.index(c[0]) + 2
        counts[v] += 1
        by_suit.setdefault(c[1], []).append(v)

    flush_ranks = next((sorted(v, reverse=True) for v in by_suit.values() if len(v) >= 5), None)
    if flush_ranks:
        sf = _straight_high(set(flush_ranks))
        if sf:
            return (8, sf)

    quads = sorted((r for r, n in counts.items() if n == 4), reverse=True)
    trips = sorted((r for r, n in counts.items() if n == 3), reverse=True)
    pairs = sorted((r for r, n in counts.items() if n == 2), reverse=True)
    singles = sorted(counts, reverse=True)

    if quads:
        kicker = max(r for r in singles if r != quads[0])
        return (7, quads[0], kicker)
    if trips and (len(trips) > 1 or pairs):
        pair = max(trips[1:] + pairs)
        return (6, trips[0], pair)
    if flush_ranks:
        return (5, *flush_ranks[:5])
    st = _straight_high(set(counts))
    if st:
        return (4, st)
    if trips:
        kick = [r for r in singles if r != trips[0]][:2]
        return (3, trips[0], *kick)
    if len(pairs) >= 2:
        kick = max(r for r in singles if r not in pairs[:2])
        return (2, pairs[0], pairs[1], kick)
    if pairs:
        kick = [r for r in singles if r != pairs[0]][:3]
        return (1, pairs[0], *kick)
    return (0, *singles[:5])


PREFLOP_SAMPLES = 30000


def equities(flop, hands, samples=PREFLOP_SAMPLES):
    """Equity per hand.

    With a 3-card flop every turn/river pair is enumerated (exact). With no
    flop (pre-flop) `samples` random boards are dealt (Monte Carlo estimate).
    flop: list of 0 or 3 cards; hands: list of 2-card lists.
    """
    flop = [parse_card(c) for c in flop]
    hands = [[parse_card(c) for c in h] for h in hands]
    if len(flop) not in (0, 3):
        raise ValueError("The flop must have exactly 3 cards (or none for pre-flop).")
    if not 2 <= len(hands) <= 9:
        raise ValueError("Provide between 2 and 9 hands.")
    if any(len(h) != 2 for h in hands):
        raise ValueError("Each hand must have exactly 2 cards.")

    used = flop + [c for h in hands for c in h]
    dupes = [c for c, n in Counter(used).items() if n > 1]
    if dupes:
        raise ValueError(f"Duplicate cards: {', '.join(dupes)}")

    remaining = [c for c in DECK if c not in set(used)]
    if flop:
        boards = (flop + list(extra) for extra in combinations(remaining, 2))
    else:
        boards = (random.sample(remaining, 5) for _ in range(samples))

    wins = [0] * len(hands)
    ties = [0] * len(hands)
    split = [0.0] * len(hands)
    total = 0
    for board in boards:
        scores = [evaluate7(h + board) for h in hands]
        top = max(scores)
        winners = [i for i, s in enumerate(scores) if s == top]
        total += 1
        if len(winners) == 1:
            wins[winners[0]] += 1
        else:
            for i in winners:
                ties[i] += 1
                split[i] += 1 / len(winners)

    return [
        {
            "hand": hands[i],
            "win": round(100 * wins[i] / total, 2),
            "tie": round(100 * ties[i] / total, 2),
            "equity": round(100 * (wins[i] + split[i]) / total, 2),
        }
        for i in range(len(hands))
    ]
