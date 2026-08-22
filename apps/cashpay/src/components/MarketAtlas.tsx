import styles from '@/app/instrument.module.css';

export function MarketAtlas({ markets }: { markets: string[] }) {
  if (markets.length === 0) {
    return <p className={styles.note}>HCL markets are not loaded in this environment.</p>;
  }

  return (
    <div className={styles.atlas}>
      {markets.map((state) => (
        <a
          key={state}
          className={styles.chip}
          href={`/search?state=${encodeURIComponent(state)}`}
        >
          {state}
        </a>
      ))}
    </div>
  );
}
