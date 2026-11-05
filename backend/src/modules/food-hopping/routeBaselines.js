// Route Planner: simple baseline methods to compare the Ant Colony Optimisation result with.
//   - Nearest neighbour: always go to the closest stop not visited yet (fast, greedy, often
//     not the best).
//   - Brute force: try every possible order and keep the best (always optimal, but the number
//     of orders grows as (n-1)!, so only used for n <= 8 stops: 7! = 5,040 orders).
// Both build OPEN routes: start at `start`, visit every stop once, no return.

const BRUTE_FORCE_MAX_STOPS = 8;

// Total travel time of an open visiting order (sum of its legs).
function orderTime(matrix, order) {
  let total = 0;
  for (let k = 1; k < order.length; k++) total += matrix[order[k - 1]][order[k]];
  return total;
}

function nearestNeighbourOrder(matrix, start = 0) {
  const n = matrix.length;
  const visited = new Uint8Array(n);
  const order = [start];
  visited[start] = 1;
  let current = start;
  while (order.length < n) {
    let best = -1;
    for (let j = 0; j < n; j++) {
      if (!visited[j] && (best < 0 || matrix[current][j] < matrix[current][best])) best = j;
    }
    order.push(best);
    visited[best] = 1;
    current = best;
  }
  return { order, totalTime: orderTime(matrix, order) };
}

// maxStops: safety limit. The API keeps the default (8); the feasibility script raises it
// to 10 (9! = 362,880 orders, a few seconds at most) to measure ACO against the optimum.
function bruteForceOrder(matrix, start = 0, maxStops = BRUTE_FORCE_MAX_STOPS) {
  const n = matrix.length;
  if (n > maxStops) {
    throw new Error(`Brute force is limited to ${maxStops} stops`);
  }
  const order = [start];
  const used = new Uint8Array(n);
  used[start] = 1;
  let best = { order: [start], totalTime: n === 1 ? 0 : Infinity };

  // Depth-first search over all permutations of the remaining stops.
  function extend(timeSoFar) {
    if (order.length === n) {
      if (timeSoFar < best.totalTime) best = { order: order.slice(), totalTime: timeSoFar };
      return;
    }
    // Pruning: a partial order already slower than the best full order cannot win.
    if (timeSoFar >= best.totalTime) return;
    const last = order[order.length - 1];
    for (let j = 0; j < n; j++) {
      if (used[j]) continue;
      used[j] = 1;
      order.push(j);
      extend(timeSoFar + matrix[last][j]);
      order.pop();
      used[j] = 0;
    }
  }
  extend(0);
  return best;
}

module.exports = { orderTime, nearestNeighbourOrder, bruteForceOrder, BRUTE_FORCE_MAX_STOPS };
