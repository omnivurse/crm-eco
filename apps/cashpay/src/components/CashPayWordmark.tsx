import { brand } from '@/lib/brand';
import styles from './CashPayWordmark.module.css';

export function CashPayWordmark() {
  return (
    <span className={styles.lockup} aria-label={`${brand.product} · ${brand.tagline}`}>
      <img
        className={styles.mark}
        src={brand.logoIcon}
        alt=""
        width={36}
        height={36}
        decoding="async"
      />
      <span className={styles.copy}>
        <span className={styles.name}>{brand.product}</span>
        <span className={styles.tagline}>{brand.tagline}</span>
      </span>
    </span>
  );
}
