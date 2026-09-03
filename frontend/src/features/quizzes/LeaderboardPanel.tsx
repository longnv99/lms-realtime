import type { QuizLeaderboardEntry } from '@lms/shared';

type LeaderboardPanelProps = {
  entries: QuizLeaderboardEntry[];
};

export function LeaderboardPanel({ entries }: LeaderboardPanelProps) {
  const sortedEntries = [...entries].sort((a, b) => b.score - a.score || a.rank - b.rank);

  return (
    <section className="leaderboard-panel" aria-labelledby="leaderboard-title">
      <div className="subpanel-header">
        <h4 id="leaderboard-title">Leaderboard</h4>
        <span>{sortedEntries.length}</span>
      </div>
      {sortedEntries.length === 0 ? (
        <p className="subtle-copy">No scores</p>
      ) : (
        <div className="leaderboard-list">
          {sortedEntries.map((entry, index) => (
            <div className="leaderboard-row" data-testid="leaderboard-row" key={entry.userId}>
              <span>{index + 1}</span>
              <strong>{entry.name}</strong>
              <span>{entry.score}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
