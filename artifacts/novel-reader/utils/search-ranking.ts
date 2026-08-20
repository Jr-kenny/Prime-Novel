export function normalizeSearchText(value: string) {
  return value.toLocaleLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
}

function editDistance(left: string, right: string) {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      );
    }
    previous.splice(0, previous.length, ...current);
  }
  return previous[right.length];
}

function tokenPenalty(titleToken: string, queryToken: string) {
  if (titleToken === queryToken) return 0;
  if (queryToken.length >= 3 && titleToken.startsWith(queryToken)) return 0.2;
  if (titleToken.length >= 3 && queryToken.startsWith(titleToken)) return 0.35;
  if (Math.max(titleToken.length, queryToken.length) >= 4 && editDistance(titleToken, queryToken) <= 1) return 0.75;
  return Number.POSITIVE_INFINITY;
}

export function titleSearchScore(titleValue: string, queryValue: string) {
  const title = normalizeSearchText(titleValue);
  const query = normalizeSearchText(queryValue);
  if (!query) return 0;
  if (!title) return Number.POSITIVE_INFINITY;
  if (title === query) return 0;

  const titleTokens = title.split(' ');
  const queryTokens = query.split(' ');
  if (title.startsWith(`${query} `)) return 5 + (titleTokens.length - queryTokens.length) * 0.05;

  for (let index = 0; index <= titleTokens.length - queryTokens.length; index += 1) {
    if (titleTokens.slice(index, index + queryTokens.length).every((token, offset) => token === queryTokens[offset])) {
      return 10 + index * 0.1 + (titleTokens.length - queryTokens.length) * 0.05;
    }
  }

  let titleIndex = 0;
  let gapCount = 0;
  let fuzzyPenalty = 0;
  let orderedMatches = 0;
  for (const queryToken of queryTokens) {
    let matchedIndex = -1;
    let matchedPenalty = Number.POSITIVE_INFINITY;
    for (let index = titleIndex; index < titleTokens.length; index += 1) {
      const penalty = tokenPenalty(titleTokens[index], queryToken);
      if (penalty < matchedPenalty) {
        matchedIndex = index;
        matchedPenalty = penalty;
      }
      if (penalty === 0) break;
    }
    if (matchedIndex < 0 || !Number.isFinite(matchedPenalty)) break;
    gapCount += matchedIndex - titleIndex;
    fuzzyPenalty += matchedPenalty;
    orderedMatches += 1;
    titleIndex = matchedIndex + 1;
  }
  if (orderedMatches === queryTokens.length) {
    return 30 + gapCount * 1.5 + fuzzyPenalty * 4 + (titleTokens.length - queryTokens.length) * 0.1;
  }

  const unmatchedTitleTokens = [...titleTokens];
  let unorderedMatches = 0;
  let unorderedPenalty = 0;
  for (const queryToken of queryTokens) {
    let bestIndex = -1;
    let bestPenalty = Number.POSITIVE_INFINITY;
    unmatchedTitleTokens.forEach((titleToken, index) => {
      const penalty = tokenPenalty(titleToken, queryToken);
      if (penalty < bestPenalty) {
        bestIndex = index;
        bestPenalty = penalty;
      }
    });
    if (bestIndex >= 0 && Number.isFinite(bestPenalty)) {
      unorderedMatches += 1;
      unorderedPenalty += bestPenalty;
      unmatchedTitleTokens.splice(bestIndex, 1);
    }
  }
  if (unorderedMatches === queryTokens.length) return 60 + unorderedPenalty * 4;

  const missingTokens = queryTokens.length - unorderedMatches;
  return 100 + missingTokens * 25 - unorderedMatches * 2 + unorderedPenalty * 4;
}

export function rankTitleSearchResults<Item extends { title: string }>(items: Item[], query: string) {
  return items
    .map((item, index) => ({ item, index, score: titleSearchScore(item.title, query) }))
    .sort((left, right) => {
      if (left.score !== right.score) return left.score - right.score;
      const titleLength = normalizeSearchText(left.item.title).length - normalizeSearchText(right.item.title).length;
      if (titleLength !== 0) return titleLength;
      return left.index - right.index;
    })
    .map(({ item }) => item);
}
