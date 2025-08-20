// returns the number of seconds until the next minute
export function secondsToNextMinute(): number {
    const now = new Date();
    const secondsUntilNextMinute = 60 - now.getSeconds();
    return secondsUntilNextMinute;
}