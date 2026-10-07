'use strict';
// Gemensam klassificering. Samma nycklar används i extraktion, databas, analys och UI,
// så att jämförelser mellan projekt blir meningsfulla.

const COST_CATEGORIES = {
  arbete: 'Arbete (timmar)',
  arbetsledning: 'Arbetsledning / projektledning',
  material: 'Material',
  forbrukningsmaterial: 'Förbrukningsmaterial',
  maskin_hyra: 'Maskin- & verktygshyra',
  avfall: 'Avfall / sophantering',
  transport_frakt: 'Transport / frakt',
  fordon_parkering: 'Servicebil / parkering / resor',
  underentreprenad: 'Underentreprenad (ospecificerad)',
  avgift: 'Avgifter / tillägg',
  ovrigt: 'Övrigt',
};

const TRADES = {
  elektriker: 'Elektriker',
  snickare: 'Snickare',
  vvs: 'VVS / rörmokare',
  malare: 'Målare',
  plattsattare: 'Plattsättare',
  golvlaggare: 'Golvläggare',
  murare: 'Murare',
  betongarbetare: 'Betongarbetare',
  rivning: 'Rivning / håltagning',
  platslagare: 'Plåtslagare',
  ventilation: 'Ventilation',
  stallning: 'Ställning',
  stad: 'Städ',
  grovarbetare: 'Grovarbetare / hantlangare',
  arbetsledare: 'Arbetsledare',
  projektledare: 'Projektledare',
  ovrigt: 'Övrigt',
};

const UNITS = ['h', 'st', 'm', 'm2', 'm3', 'kg', 'ton', 'l', 'dag', 'vecka', 'manad', 'km', 'sack', 'pkt', 'pall', 'sats', 'ovrigt'];

const INVOICE_KINDS = ['huvudfaktura', 'underleverantorsfaktura', 'kvitto', 'kreditfaktura', 'ovrigt'];
const SUPPORT_TYPES = ['arbetsbeskrivning', 'tidrapport', 'foljesedel', 'ata_underlag', 'ritning', 'ovrigt'];

module.exports = { COST_CATEGORIES, TRADES, UNITS, INVOICE_KINDS, SUPPORT_TYPES };
