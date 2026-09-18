'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, Check, ChevronsUpDown, X, Briefcase } from 'lucide-react';

export default function ClientCombobox({
  clients = [],
  selectedClient = null,
  onSelectClient,
  disabled = false,
  label = 'Client',
  placeholder = 'Rechercher un client...',
  accentColor = 'var(--brand-orange, #ea580c)',
  style = {}
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const containerRef = useRef(null);
  const searchInputRef = useRef(null);
  const listRef = useRef(null);

  // Normaliser le texte pour une recherche insensible aux accents et à la casse
  const normalizeText = (text) => {
    return (text || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  };

  // Filtrage en temps réel des clients
  const filteredClients = useMemo(() => {
    if (!searchQuery.trim()) return clients;
    const cleanQuery = normalizeText(searchQuery);
    return clients.filter(c => {
      const name = normalizeText(c.name);
      const code = normalizeText(c.code);
      return name.includes(cleanQuery) || code.includes(cleanQuery);
    });
  }, [clients, searchQuery]);

  // Focus automatique sur le champ de recherche à l'ouverture
  useEffect(() => {
    if (isOpen) {
      setHighlightedIndex(0);
      const timer = setTimeout(() => {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }, 40);
      return () => clearTimeout(timer);
    } else {
      setSearchQuery('');
    }
  }, [isOpen]);

  // Fermeture automatique lors d'un clic en dehors
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen]);

  // Navigation clavier fluide (Flèche Haut, Flèche Bas, Entrée, Échap)
  const handleKeyDown = (e) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => (prev < filteredClients.length - 1 ? prev + 1 : 0));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => (prev > 0 ? prev - 1 : filteredClients.length - 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredClients.length > 0 && highlightedIndex >= 0 && highlightedIndex < filteredClients.length) {
          const clientToSelect = filteredClients[highlightedIndex];
          if (onSelectClient) onSelectClient(clientToSelect);
          setIsOpen(false);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        break;
      case 'Tab':
        setIsOpen(false);
        break;
      default:
        break;
    }
  };

  // Scroll automatique vers l'élément survolé au clavier
  useEffect(() => {
    if (isOpen && listRef.current && listRef.current.children[highlightedIndex]) {
      const itemEl = listRef.current.children[highlightedIndex];
      itemEl.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIndex, isOpen]);

  const handleSelect = (client) => {
    if (disabled) return;
    if (onSelectClient) onSelectClient(client);
    setIsOpen(false);
  };

  return (
    <div
      ref={containerRef}
      className="client-combobox-wrapper"
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        minWidth: '260px',
        maxWidth: '460px',
        width: '100%',
        ...style
      }}
      onKeyDown={handleKeyDown}
    >
      {label && (
        <div style={{
          fontSize: '0.75rem',
          fontWeight: '800',
          textTransform: 'uppercase',
          letterSpacing: '0.6px',
          color: '#475569',
          marginBottom: '6px',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
            <Briefcase size={14} style={{ color: 'var(--brand-orange, #ea580c)' }} />
            {label}
          </span>
          {clients.length > 0 && (
            <span style={{
              fontSize: '0.68rem',
              fontWeight: '800',
              padding: '0.08rem 0.45rem',
              borderRadius: '9999px',
              background: 'rgba(234, 88, 12, 0.1)',
              color: 'var(--brand-orange, #ea580c)'
            }}>
              {clients.length}
            </span>
          )}
        </div>
      )}

      {/* Bouton de déclenchement (Trigger) */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(prev => !prev)}
        disabled={disabled}
        className={`client-combobox-trigger ${isOpen ? 'open' : ''} ${disabled ? 'disabled' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        title={disabled ? 'Chronomètre actif : arrêtez le chrono pour changer de client' : (selectedClient ? `${selectedClient.code || ''} - ${selectedClient.name || ''}` : placeholder)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.5rem',
          padding: '0.55rem 0.85rem',
          borderRadius: '9px',
          border: isOpen ? '1.5px solid var(--brand-orange, #ea580c)' : '1.5px solid var(--border-color, #cbd5e1)',
          background: disabled ? '#f8fafc' : '#ffffff',
          color: disabled ? '#94a3b8' : '#0f172a',
          fontSize: '0.92rem',
          fontWeight: '700',
          cursor: disabled ? 'not-allowed' : 'pointer',
          boxShadow: isOpen ? '0 0 0 3px rgba(234, 88, 12, 0.12)' : '0 1px 3px rgba(0, 0, 0, 0.04)',
          transition: 'all 0.15s ease',
          outline: 'none',
          textAlign: 'left',
          width: '100%',
          opacity: disabled ? 0.85 : 1
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', overflow: 'hidden', flex: 1 }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '26px',
            height: '26px',
            borderRadius: '6px',
            background: selectedClient ? 'rgba(23, 143, 203, 0.12)' : 'rgba(100, 116, 139, 0.08)',
            color: selectedClient ? '#178FCB' : '#94a3b8',
            flexShrink: 0
          }}>
            <Briefcase size={14} />
          </div>

          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
            {selectedClient ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', maxWidth: '100%' }}>
                {selectedClient.code && (
                  <span style={{
                    fontSize: '0.72rem',
                    fontWeight: '800',
                    color: '#64748b',
                    background: '#f1f5f9',
                    padding: '0.12rem 0.4rem',
                    borderRadius: '4px',
                    letterSpacing: '0.3px',
                    flexShrink: 0
                  }}>
                    {selectedClient.code}
                  </span>
                )}
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: '700', color: '#0f172a' }}>
                  {selectedClient.name}
                </span>
              </span>
            ) : (
              <span style={{ color: '#94a3b8', fontWeight: '500' }}>
                {placeholder}
              </span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', color: '#64748b', flexShrink: 0 }}>
          <ChevronsUpDown size={15} style={{ opacity: disabled ? 0.4 : 0.7 }} />
        </div>
      </button>

      {/* Menu déroulant Popover avec recherche */}
      {isOpen && (
        <div
          className="client-combobox-dropdown"
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            zIndex: 1050,
            background: '#ffffff',
            borderRadius: '10px',
            border: '1px solid var(--border-light, #e2e8f0)',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.12), 0 8px 10px -6px rgba(0, 0, 0, 0.06)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          {/* Champ de recherche */}
          <div style={{
            padding: '0.5rem',
            borderBottom: '1px solid #f1f5f9',
            background: '#f8fafc',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem'
          }}>
            <Search size={14} style={{ color: '#94a3b8', marginLeft: '0.25rem', flexShrink: 0 }} />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filtrer par nom ou code..."
              style={{
                width: '100%',
                border: 'none',
                background: 'transparent',
                fontSize: '0.85rem',
                fontWeight: '600',
                color: '#0f172a',
                outline: 'none',
                padding: '0.2rem 0'
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '0.2rem',
                  display: 'flex',
                  alignItems: 'center',
                  color: '#94a3b8'
                }}
                title="Effacer la recherche"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Liste déroulante des résultats */}
          <div
            ref={listRef}
            role="listbox"
            style={{
              maxHeight: '260px',
              overflowY: 'auto',
              padding: '0.35rem'
            }}
          >
            {filteredClients.length === 0 ? (
              <div style={{
                padding: '1.25rem 0.75rem',
                textAlign: 'center',
                color: '#64748b',
                fontSize: '0.82rem'
              }}>
                <div style={{ fontWeight: '700', color: '#334155', marginBottom: '0.2rem' }}>
                  Aucun client trouvé
                </div>
                <span>Aucun résultat pour « {searchQuery} »</span>
              </div>
            ) : (
              filteredClients.map((client, index) => {
                const isSelected = selectedClient && selectedClient.id === client.id;
                const isHighlighted = highlightedIndex === index;

                return (
                  <div
                    key={client.id}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelect(client)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '0.5rem',
                      padding: '0.45rem 0.65rem',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      background: isSelected
                        ? 'rgba(234, 88, 12, 0.08)'
                        : isHighlighted
                          ? '#f1f5f9'
                          : 'transparent',
                      borderLeft: isSelected ? '3px solid var(--brand-orange, #ea580c)' : '3px solid transparent',
                      transition: 'background 0.1s ease',
                      fontSize: '0.86rem'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflow: 'hidden', flex: 1 }}>
                      {client.code && (
                        <span style={{
                          fontSize: '0.7rem',
                          fontWeight: '800',
                          color: isSelected ? 'var(--brand-orange, #ea580c)' : '#475569',
                          background: isSelected ? '#fed7aa' : '#e2e8f0',
                          padding: '0.1rem 0.35rem',
                          borderRadius: '4px',
                          letterSpacing: '0.3px',
                          flexShrink: 0
                        }}>
                          {client.code}
                        </span>
                      )}
                      <span style={{
                        fontWeight: isSelected ? '800' : '600',
                        color: isSelected ? 'var(--brand-navy, #0f172a)' : '#334155',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {client.name}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
                      {client.total_spent_hours !== undefined && (
                        <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: '600' }}>
                          {client.total_spent_hours}h
                        </span>
                      )}
                      {isSelected && (
                        <Check size={14} style={{ color: 'var(--brand-orange, #ea580c)', strokeWidth: 3 }} />
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Pied de liste avec compteur */}
          {filteredClients.length > 0 && (
            <div style={{
              padding: '0.35rem 0.65rem',
              background: '#f8fafc',
              borderTop: '1px solid #f1f5f9',
              fontSize: '0.68rem',
              color: '#94a3b8',
              fontWeight: '600',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span>{filteredClients.length} client{filteredClients.length > 1 ? 's' : ''} {searchQuery ? 'trouvé(s)' : 'au total'}</span>
              <span style={{ fontSize: '0.62rem', color: '#cbd5e1' }}>↑↓ Naviguer • ↵ Choisir</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
