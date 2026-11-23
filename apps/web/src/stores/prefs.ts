import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { loadJSON, saveJSON } from '@/lib/persist';

const STORAGE_KEY = 'hmm.prefs.v1';

export interface Prefs {
  /** 质保到期提前多少天开始提醒 */
  warrantyLeadDays: number;
  /** 预计更换提前多少天开始提醒 */
  replaceLeadDays: number;
}

const DEFAULTS: Prefs = { warrantyLeadDays: 60, replaceLeadDays: 90 };

export const WARRANTY_LEAD_OPTIONS = [15, 30, 60, 90, 180];
export const REPLACE_LEAD_OPTIONS = [30, 60, 90, 120, 180, 365];

export const usePrefsStore = defineStore('prefs', () => {
  const prefs = ref<Prefs>({ ...DEFAULTS });

  function load() {
    prefs.value = { ...DEFAULTS, ...loadJSON<Partial<Prefs>>(STORAGE_KEY, {}) };
  }

  function save() {
    saveJSON(STORAGE_KEY, prefs.value);
  }

  function setWarrantyLead(days: number) {
    prefs.value.warrantyLeadDays = days;
    save();
  }

  function setReplaceLead(days: number) {
    prefs.value.replaceLeadDays = days;
    save();
  }

  const warrantyLeadDays = computed(() => prefs.value.warrantyLeadDays);
  const replaceLeadDays = computed(() => prefs.value.replaceLeadDays);

  return {
    prefs,
    load,
    save,
    setWarrantyLead,
    setReplaceLead,
    warrantyLeadDays,
    replaceLeadDays,
  };
});
