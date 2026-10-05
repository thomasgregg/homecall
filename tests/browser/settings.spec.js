import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
const script = await readFile(
  new URL(
    "../../custom_components/homecall/frontend/homecall-settings.js",
    import.meta.url,
  ),
  "utf8",
);
async function fixture(page, language = "en", transport = "dlna") {
  await page.setContent(
    "<style>body{font:16px Arial;background:#f5f5f5;--primary-text-color:#222;--secondary-text-color:#666;--divider-color:#ddd;--secondary-background-color:#f4f4f4}ha-card{display:block;background:white;border:1px solid #ddd;border-radius:16px}ha-list-item-button{display:flex;padding:20px;gap:14px;cursor:pointer}ha-button{display:inline-block;padding:12px;background:#009ac0;color:white;border-radius:10px;cursor:pointer}ha-button[disabled]{pointer-events:none;opacity:.5}ha-icon{width:24px}ha-list-item-base{display:block;padding:20px}</style><main></main>",
  );
  await page.evaluate(() => {
    customElements.define("hass-subpage", class extends HTMLElement {});
    customElements.define("ha-expansion-panel", class extends HTMLElement {
      connectedCallback() {
        this.attachShadow({mode:"open"});
        this.shadowRoot.innerHTML = '<div><slot name="leading-icon"></slot><button type="button"><slot name="header"></slot></button></div><section><slot></slot></section>';
        this.shadowRoot.querySelector('slot[name="header"]').textContent = this.getAttribute('header') || '';
        this.shadowRoot.querySelector('button').onclick = () => {
          this.expanded = !this.expanded;
          this.dispatchEvent(new CustomEvent('expanded-changed',{detail:{expanded:this.expanded}}));
        };
      }
      get expanded() { return this.hasAttribute('expanded'); }
      set expanded(value) {
        this.toggleAttribute('expanded',value);
        this.shadowRoot.querySelector('section').hidden = !value;
      }
    });
    customElements.define(
      "ha-checkbox",
      class extends HTMLElement {
        get checked() {
          return this.hasAttribute("checked");
        }
        set checked(v) {
          this.toggleAttribute("checked", v);
        }
      },
    );
    customElements.define(
      "ha-form",
      class extends HTMLElement {
        set schema(v) {
          this._schema = v;
          this.innerHTML =
            v[0]?.name === "speaker"
              ? '<label>Choose a speaker<select><option value="">Choose a speaker</option><option value="media_player.jbl">JBL Charge 5 Wi-Fi</option></select></label>'
              : "";
          this.querySelector("select")?.addEventListener("change", (e) => {
            this.data = { speaker: e.target.value };
            this.dispatchEvent(
              new CustomEvent("value-changed", { bubbles: true }),
            );
          });
        }
        get schema() {
          return this._schema;
        }
        reportValidity() {
          return !!this.data.speaker;
        }
      },
    );
  });
  await page.addScriptTag({ content: script });
  await page.evaluate(({language, transport}) => {
    window.calls = [];
    window.failTest = false;
    const candidate = {
      entity_id: "media_player.jbl",
      name: "JBL Charge 5 Wi-Fi",
      available: true,
      transport,
    };
    window.settings = {
      public_url: "https://ha.example.com",
      use_system_url: true,
      use_all: true,
      default_targets: [],
      tested_dlna: [],
      resume_dlna: [],
      local_url: "",
      targets: [
        { entity_id: "notify.kitchen_speak", name: "Kitchen", available: true },
      ],
      dlna_candidates: [candidate],
    };
    const el = document.createElement("homecall-settings");
    el.hass = {
      language,
      callApi: async (method, path, data) => {
        window.calls.push({ method, path, data });
        if (method === "GET") return structuredClone(window.settings);
        if (data.action === "test") {
          if (window.failTest) throw { body: { error: "test_failed" } };
          return { receipt: "receipt" };
        }
        if (data.action === "confirm") {
          window.settings.tested_dlna = [candidate.entity_id];
          window.settings.default_targets = [candidate.entity_id];
          window.settings.targets.push(candidate);
          return structuredClone(window.settings);
        }
        if (data.action === "resume") {
          window.settings.resume_dlna = data.enabled
            ? [candidate.entity_id]
            : [];
          return structuredClone(window.settings);
        }
        if (data.action === "remove") {
          window.settings.tested_dlna = [];
          window.settings.default_targets = [];
          return structuredClone(window.settings);
        }
        if (data.removed_dlna) {
          window.settings.tested_dlna = window.settings.tested_dlna.filter(id => !data.removed_dlna.includes(id));
        }
        Object.assign(window.settings, data);
        return structuredClone(window.settings);
      },
    };
    document.querySelector("main").append(el);
  }, {language, transport});
  await expect(page.getByText(language === "de" ? "Alexa-Lautsprecher" : "Alexa speakers", { exact: true })).toBeVisible();
}
async function toggle(page, selector, checked) {
  await page.locator(selector).evaluate((el, value) => {
    el.checked = value;
    el.dispatchEvent(new Event("change"));
  }, checked);
}
async function addDlna(page) {
  await page.locator('[data-page="dlna"]').click();
  await page.locator('[data-test="media_player.jbl"]').click();
  await page.locator('.confirm-test').click();
}
test('inline sound test confirms before registering, and removal stays per speaker', async ({page}) => {
  await fixture(page);
  await page.locator('[data-page="dlna"]').click();
  await expect(page.locator('.save')).toHaveCount(1);
  await page.locator('[data-test="media_player.jbl"]').click();
  await expect(page.getByText('Did you hear the sound?', {exact:true})).toBeVisible();
  expect(await page.evaluate(() => window.settings.tested_dlna)).toEqual([]);
  await page.locator('.retry-test').click();
  await expect(page.locator('.confirm-test')).toHaveCount(0);
  await page.locator('[data-test="media_player.jbl"]').click();
  await page.locator('.confirm-test').click();
  await expect(page.locator('[data-visible="media_player.jbl"]')).toHaveAttribute('checked','');
  await page.locator('[data-speaker-panel] button').click();
  await page.locator('[data-remove]').click();
  await expect(page.locator('[data-visible]')).toHaveCount(0);
  expect(await page.evaluate(() => window.settings.tested_dlna)).toEqual(['media_player.jbl']);
  await page.locator('homecall-settings').evaluate(el => el._back());
  await page.locator('[data-page="dlna"]').click();
  await expect(page.locator('[data-visible="media_player.jbl"]')).toHaveCount(1);
  await page.locator('[data-speaker-panel] button').click();
  await page.locator('[data-remove]').click();
  await page.locator('.save').click();
  expect(await page.evaluate(() => window.settings.tested_dlna)).toEqual([]);
});
test('failed and offline tests never register speakers', async ({page}) => {
  await fixture(page);
  await page.evaluate(() => window.failTest = true);
  await page.locator('[data-page="dlna"]').click();
  await page.locator('[data-test="media_player.jbl"]').click();
  await expect(page.getByText('The speaker could not start playback. Check its connection and try again.')).toBeVisible();
  await expect(page.locator('.confirm-test')).toHaveCount(0);
  expect(await page.evaluate(() => window.settings.tested_dlna)).toEqual([]);
  await page.evaluate(() => window.settings.dlna_candidates[0].available = false);
  await page.locator('.refresh-speakers').click();
  await expect(page.locator('[data-test]')).toHaveAttribute('disabled','');
  await expect(page.getByText('Turn on these speakers to run the sound test.')).toBeVisible();
});
test('resume and visibility remain drafts until one page-level Save', async ({page}) => {
  await fixture(page);
  await addDlna(page);
  await page.locator('[data-speaker-panel] button').click();
  await toggle(page,'[data-resume]',true);
  await toggle(page,'[data-visible]',false);
  expect(await page.evaluate(() => window.settings.resume_dlna)).toEqual([]);
  expect(await page.evaluate(() => window.settings.default_targets)).toEqual(['media_player.jbl']);
  await expect(page.locator('.save')).toHaveCount(1);
  expect(await page.locator('.save').evaluate(el=>el.closest('ha-card'))).toBeNull();
  await page.locator('.save').click();
  expect(await page.evaluate(() => window.settings.resume_dlna)).toEqual(['media_player.jbl']);
  expect(await page.evaluate(() => window.settings.default_targets)).toEqual([]);
});
test('Alexa select all selects current speakers, preserves DLNA and supports partial selection', async ({page}) => {
  await fixture(page);
  await page.evaluate(() => {
    const el=document.querySelector('homecall-settings');
    el._data.targets.push({entity_id:'notify.bedroom_speak',name:'Bedroom',available:false});
    el._data.default_targets=['media_player.jbl'];
    el._data.use_all=false;
    el._data.added_speakers=['notify.kitchen_speak','notify.bedroom_speak'];
  });
  await page.locator('[data-page="devices"]').click();
  await toggle(page,'[data-select-all]',true);
  await toggle(page,'[data-visible="notify.bedroom_speak"]',false);
  expect(await page.locator('[data-select-all]').evaluate(el=>el.indeterminate)).toBe(true);
  await page.locator('.save').click();
  expect(await page.evaluate(() => window.settings.default_targets)).toEqual(['media_player.jbl','notify.kitchen_speak']);
  expect(await page.evaluate(() => window.settings.use_all)).toBe(false);
});
test('refresh preserves unsaved visibility and resume changes', async ({page}) => {
  await fixture(page);
  await addDlna(page);
  await page.locator('[data-speaker-panel] button').click();
  await toggle(page,'[data-resume]',true);
  await toggle(page,'[data-visible]',false);
  await page.locator('[data-available-panel] button').click();
  await page.locator('.refresh-speakers').click();
  await expect(page.locator('[data-visible]')).not.toHaveAttribute('checked','');
  await expect(page.locator('[data-resume]')).toHaveAttribute('checked','');
});
for (const language of ['en','de']) {
  for (const dark of [false,true]) {
    test(`native controls and theme inheritance: ${language}, ${dark?'dark':'light'}`, async ({page}) => {
      await fixture(page,language);
      await page.evaluate(dark=>{
        document.body.style.setProperty('--primary-text-color',dark?'#eee':'#222');
        document.body.style.setProperty('--secondary-text-color',dark?'#bbb':'#666');
      },dark);
      for(const name of ['devices','dlna']) {
        await page.locator(`[data-page="${name}"]`).click();
        await expect(page.locator('.save')).toHaveCount(1);
        const data=await page.locator('homecall-settings').evaluate(el=>({
          css:el.shadowRoot.querySelector('style').textContent,
          controls:el.shadowRoot.querySelectorAll('button,input,select,textarea').length,
          speakerIcons:el.shadowRoot.querySelectorAll('ha-icon[icon="mdi:speaker"]').length,
          color:getComputedStyle(el).color,
        }));
        expect(data.css).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(|::part|--ha-checkbox-|--ha-button-/iu);
        expect(data.controls).toBe(0);
        expect(data.speakerIcons).toBe(0);
        expect(data.color).toBe(dark?'rgb(238, 238, 238)':'rgb(34, 34, 34)');
        await expect(page.getByText(language==='de'?'Alle auswählen':'Select all',{exact:true})).toBeVisible();
        await expect(page.getByText(/current volume|replaces any|aktuelle Lautstärke/)).toHaveCount(0);
        await page.locator('.close').evaluate(el=>el.click());
      }
    });
  }
}

test('HA form loader imports native speaker controls once and removes its bootstrap form', async ({page}) => {
  await page.setContent('<main></main>');
  await page.addScriptTag({content:script});
  const result=await page.evaluate(async () => {
    let loads=0;
    let schema;
    customElements.define('ha-form',class extends HTMLElement {
      connectedCallback(){
        loads++;
        schema=this.schema;
        queueMicrotask(()=>{
          customElements.define('ha-expansion-panel',class extends HTMLElement {});
          customElements.define('ha-checkbox',class extends HTMLElement {});
        });
      }
    });
    const host=document.createElement('div');
    host.attachShadow({mode:'open'});
    document.querySelector('main').append(host);
    await homeCallNativeSpeakerControls(host,{});
    await homeCallNativeSpeakerControls(host,{});
    return {loads,schema,remaining:host.shadowRoot.childElementCount};
  });
  expect(result.loads).toBe(1);
  expect(result.schema.map(item=>item.type)).toEqual(['expandable','multi_select']);
  expect(result.remaining).toBe(0);
});

test('pending test shows row progress, disables controls and cannot add until confirmed', async ({page}) => {
  await fixture(page);
  await page.evaluate(()=>{
    const hass=document.querySelector('homecall-settings')._hass;
    const original=hass.callApi;
    hass.callApi=async (...args)=>{
      if(args[2]?.action==='test') await new Promise(resolve=>window.finishTest=resolve);
      return original(...args);
    };
  });
  await page.locator('[data-page="dlna"]').click();
  await page.locator('[data-test]').click();
  await expect(page.locator('[data-test]')).toHaveAttribute('disabled','');
  await expect(page.locator('.test-content ha-alert')).toContainText('Playing test');
  await expect(page.locator('.confirm-test')).toHaveCount(0);
  expect(await page.evaluate(()=>window.settings.tested_dlna)).toEqual([]);
  await page.evaluate(()=>window.finishTest());
  await expect(page.locator('.confirm-test')).toBeVisible();
});

test('discarding draft resume and selection edits leaves saved settings unchanged', async ({page}) => {
  await fixture(page);
  await addDlna(page);
  await page.locator('[data-speaker-panel] button').click();
  await toggle(page,'[data-resume]',true);
  await toggle(page,'[data-visible]',false);
  await page.locator('.close').evaluate(el=>el.click());
  await page.locator('[data-page="dlna"]').click();
  await expect(page.locator('[data-visible]')).toHaveAttribute('checked','');
  await page.locator('[data-speaker-panel] button').click();
  await expect(page.locator('[data-resume]')).not.toHaveAttribute('checked','');
});

test('Refresh is only available beside the expanded discovery list', async ({page}) => {
  await fixture(page);
  await page.locator('[data-page="dlna"]').click();
  await expect(page.locator('.refresh-speakers')).toBeVisible();
  await page.locator('[data-available-panel] button').click();
  await expect(page.locator('.refresh-speakers')).not.toBeVisible();
  await page.locator('[data-available-panel] button').click();
  await page.locator('.refresh-speakers').click();
  await expect(page.locator('[data-available-panel]')).toHaveAttribute('expanded','');
  await expect(page.locator('[data-test]')).toBeVisible();
});


test('Sonos onboarding and visibility use local speakers without DLNA resume', async ({page}) => {
  await fixture(page, "en", "sonos");
  await expect(page.locator('[data-page="sonos"]')).toContainText('Sonos speakers');
  await page.locator('[data-page="sonos"]').click();
  await page.locator('[data-add="media_player.jbl"]').click();
  await page.locator('[data-speaker-panel] button').click();
  await page.locator('[data-test="media_player.jbl"]').click();
  await expect(page.locator('.confirm-test')).toHaveCount(0);
  await toggle(page, '[data-visible]', true);
  if (!await page.locator('.refresh-speakers').isVisible())
    await page.locator('[data-available-panel] button').first().click();
  await page.locator('.refresh-speakers').click();
  await expect(page.locator('[data-visible="media_player.jbl"]')).toHaveAttribute('checked', '');
  await expect(page.locator('[data-resume]')).toHaveCount(0);
  await toggle(page, '[data-visible]', false);
  await page.locator('.save').click();
  expect(await page.evaluate(() => window.settings.default_targets)).toEqual([]);
  await page.locator('[data-page="devices"]').click();
  await expect(page.locator('[data-visible="media_player.jbl"]')).toHaveCount(0);
});


test('local platform pages filter discovery and preserve other platform selections', async ({page}) => {
  await fixture(page);
  await page.evaluate(() => {
    const sonos = {entity_id: "media_player.sonos", name: "Sonos One", available: true, transport: "sonos"};
    window.settings.dlna_candidates.push(sonos);
    window.settings.targets.push(sonos);
    window.settings.tested_dlna.push(sonos.entity_id);
    window.settings.default_targets.push(sonos.entity_id);
  });
  await page.evaluate(() => document.querySelector('homecall-settings')._load());
  await page.locator('[data-page="dlna"]').click();
  await page.locator('.refresh-speakers').click();
  await expect(page.locator('[data-test="media_player.jbl"]')).toBeVisible();
  await expect(page.locator('[data-visible="media_player.sonos"]')).toHaveCount(0);
  await page.locator('.save').click();
  expect(await page.evaluate(() => window.settings.default_targets)).toContain('media_player.sonos');
  await page.locator('[data-page="sonos"]').click();
  await expect(page.locator('[data-visible="media_player.sonos"]')).toHaveAttribute('checked','');
  await expect(page.locator('[data-test="media_player.jbl"]')).toHaveCount(0);
});


test('Alexa add/remove and visibility are separate drafts until Save', async ({page}) => {
  await fixture(page);
  await page.locator('[data-page="devices"]').click();
  await page.locator('[data-speaker-panel] button').click();
  await page.locator('[data-remove="notify.kitchen_speak"]').click();
  await expect(page.locator('[data-add="notify.kitchen_speak"]')).toBeVisible();
  expect(await page.evaluate(() => window.settings.added_speakers)).toBeUndefined();
  await page.locator('homecall-settings').evaluate(el => el._back());
  await page.locator('[data-page="devices"]').click();
  await expect(page.locator('[data-visible="notify.kitchen_speak"]')).toHaveCount(1);
  await page.locator('[data-speaker-panel] button').click();
  await page.locator('[data-remove="notify.kitchen_speak"]').click();
  await page.locator('.save').click();
  expect(await page.evaluate(() => window.settings.added_speakers)).toEqual([]);
  await page.locator('[data-page="devices"]').click();
  await page.locator('[data-add="notify.kitchen_speak"]').click();
  await toggle(page, '[data-visible="notify.kitchen_speak"]', false);
  await expect(page.locator('[data-visible="notify.kitchen_speak"]')).toHaveCount(1);
  await page.locator('.save').click();
  expect(await page.evaluate(() => window.settings.added_speakers)).toEqual(['notify.kitchen_speak']);
  expect(await page.evaluate(() => window.settings.default_targets)).toEqual([]);
});

test('Music Assistant onboarding and visibility use local speakers without DLNA resume', async ({page}) => {
  await fixture(page, "en", "music_assistant");
  await expect(page.locator('[data-page="music_assistant"]')).toContainText('Music Assistant speakers');
  await page.locator('[data-page="music_assistant"]').click();
  await page.locator('[data-add="media_player.jbl"]').click();
  await page.locator('[data-speaker-panel] button').click();
  await page.locator('[data-test="media_player.jbl"]').click();
  await expect(page.locator('.confirm-test')).toHaveCount(0);
  await toggle(page, '[data-visible]', true);
  if (!await page.locator('.refresh-speakers').isVisible())
    await page.locator('[data-available-panel] button').first().click();
  await page.locator('.refresh-speakers').click();
  await expect(page.locator('[data-visible="media_player.jbl"]')).toHaveAttribute('checked', '');
  await expect(page.locator('[data-resume]')).toHaveCount(0);
  await toggle(page, '[data-visible]', false);
  await page.locator('.save').click();
  expect(await page.evaluate(() => window.settings.default_targets)).toEqual([]);
  await page.locator('[data-page="devices"]').click();
  await expect(page.locator('[data-visible="media_player.jbl"]')).toHaveCount(0);
});
