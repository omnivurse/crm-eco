'use client';

import { FileText } from '@phosphor-icons/react';
import { toast } from 'sonner';
import {
  buildBookRateNoteHtml,
  openRateNoteWindow,
  type RateBookCompile,
  type RateClipSnapshot,
} from '@crm-eco/cash-pay';
import styles from './instrument.module.css';

const CASHPAY_LOGO_PATH = '/cashpay-logo.png';

interface RateNoteButtonProps {
  bookName: string;
  memberName: string;
  postalCode: string;
  compile: RateBookCompile;
  clips: RateClipSnapshot[];
}

export function RateNoteButton({
  bookName,
  memberName,
  postalCode,
  compile,
  clips,
}: RateNoteButtonProps) {
  const handlePrint = () => {
    if (clips.length === 0) {
      toast.error('Clip a tick before printing a rate note.');
      return;
    }
    const opened = openRateNoteWindow(
      buildBookRateNoteHtml({
        bookName,
        memberName,
        postalCode,
        compile,
        clips,
        asOf: new Date().toLocaleDateString(),
        logoUrl: new URL(CASHPAY_LOGO_PATH, window.location.origin).href,
      }),
    );
    if (!opened) {
      toast.error('Allow pop-ups to print the rate note.');
    }
  };

  return (
    <button type="button" className={styles.ghostBtn} onClick={handlePrint}>
      <FileText weight="light" className="mr-2 h-4 w-4" aria-hidden />
      Rate note
    </button>
  );
}
