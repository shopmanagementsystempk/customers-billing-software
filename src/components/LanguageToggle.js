import React from 'react';
import { Button } from 'react-bootstrap';
import { useLanguage } from '../contexts/LanguageContext';
import translations from '../utils/translations';

function LanguageToggle({
  variant = 'outline-light',
  size = 'sm',
  className = '',
  isCompact = false,
  ...buttonProps
}) {
  const { language, toggleLanguage } = useLanguage();

  const getLabel = () => {
    if (isCompact) {
      if (language === 'en') return 'UR';
      if (language === 'ur') return 'FI';
      return 'EN';
    }
    if (language === 'en') return translations.en.switchToUrdu;
    if (language === 'ur') return translations.ur.switchToFinnish;
    return translations.fi.switchToEnglish;
  };

  const label = getLabel();

  const classes = [
    'language-toggle-btn',
    isCompact ? 'language-toggle-btn--compact' : '',
    className
  ].filter(Boolean).join(' ');

  return (
    <Button
      variant={variant}
      className={classes}
      onClick={toggleLanguage}
      size={size}
      {...buttonProps}
    >
      {label}
    </Button>
  );
}

export default LanguageToggle;