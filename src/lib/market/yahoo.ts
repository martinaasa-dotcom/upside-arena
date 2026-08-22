import "server-only";

/*
  The one Yahoo client this process uses.

  The library negotiates a cookie and a crumb before its first request and
  holds them on the instance. Quotes and chart bars each used to build their
  own instance, so a process did that handshake twice and kept two sets of
  credentials warm for one upstream.

  Held as the promise rather than the client so that two callers arriving
  together share one handshake instead of racing to perform it twice, which
  is exactly what happens on a cold start: the first page to render asks for
  a benchmark open and a set of quotes at the same moment.
*/

let client: Promise<unknown> | null = null;

export function getYahoo(): Promise<never> {
  client ??= import("yahoo-finance2")
    .then(
      ({ default: YahooFinance }) =>
        new YahooFinance({ suppressNotices: ["yahooSurvey"] })
    )
    .catch((error) => {
      // A failed import must not leave every later call awaiting the same
      // rejected promise for the life of the process.
      client = null;
      throw error;
    });

  return client as Promise<never>;
}
