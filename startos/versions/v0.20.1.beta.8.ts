import { IMPOSSIBLE, VersionInfo, YAML } from '@start9labs/start-sdk'
import { readFile, rm } from 'fs/promises'
import { lndConfFile } from '../fileModels/lnd.conf'
import { storeJson } from '../fileModels/store.json'
import { bitcoindBundle, neutrinoBundle } from '../utils'

type OldConfig = {
  bitcoind: { type: 'none' } | { type: 'internal' }
  watchtowers: {
    'wt-client':
      | { enabled: 'disabled' }
      | { enabled: 'enabled'; 'add-watchtowers': string[] }
  }
  advanced?: {
    'protocol-simple-taproot-chans'?: boolean
  }
}

export const v_0_20_1_beta_8 = VersionInfo.of({
  version: '0.20.1-beta:8',
  releaseNotes: {
    en_US: `**Features**

- Expose Experimental Taproot Channels (and Taproot Overlay Channels) in Channel Settings. The 0.3.5.x → 0.4.x migration now carries over a prior Experimental Taproot Channels setting.`,
    es_ES: `**Funcionalidades**

- Se exponen los Canales Taproot Experimentales (y Canales Overlay Taproot) en Configuración de Canales. La migración 0.3.5.x → 0.4.x ahora conserva el ajuste previo de Canales Taproot Experimentales.`,
    de_DE: `**Funktionen**

- Experimentelle Taproot-Kanäle (und Taproot-Overlay-Kanäle) sind jetzt in den Kanaleinstellungen verfügbar. Die Migration 0.3.5.x → 0.4.x übernimmt eine vorhandene Einstellung für experimentelle Taproot-Kanäle.`,
    pl_PL: `**Funkcje**

- Udostępniono Eksperymentalne Kanały Taproot (i Kanały Nakładkowe Taproot) w Ustawieniach Kanałów. Migracja 0.3.5.x → 0.4.x przenosi teraz wcześniejsze ustawienie Eksperymentalnych Kanałów Taproot.`,
    fr_FR: `**Fonctionnalités**

- Les Canaux Taproot Expérimentaux (et les Canaux Taproot en Surcouche) sont désormais accessibles dans les Paramètres de Canaux. La migration 0.3.5.x → 0.4.x conserve désormais un réglage existant de Canaux Taproot Expérimentaux.`,
  },
  migrations: {
    up: async ({ effects }) => {
      // Try to read the old 0.3.5.x config. If it exists, we're migrating
      // from 0.3.5.x and need to carry over settings to the new store format.
      const configYaml: OldConfig | undefined = await readFile(
        '/media/startos/volumes/main/start9/config.yaml',
        'utf-8',
      ).then(YAML.parse, () => undefined)

      const prev = await storeJson
        .read()
        .once()
        .catch(() => null)
      if (configYaml) {
        const wtClient = configYaml.watchtowers?.['wt-client']

        await storeJson.merge(effects, {
          // The seed file uses "N word" format, one per line. Not all
          // installations have one, so fall back to null.
          aezeedCipherSeed:
            prev?.aezeedCipherSeed ||
            (await readFile(
              '/media/startos/volumes/main/start9/cipherSeedMnemonic.txt',
              'utf8',
            ).then(
              (contents) => {
                const words = contents
                  .trimEnd()
                  .split('\n')
                  .map((line) => line.split(' ')[1])
                return words.length === 24 ? words : null
              },
              () => null,
            )),
          walletPassword:
            prev?.walletPassword ||
            (await readFile('/media/startos/volumes/main/pwd.dat').then((buf) =>
              buf.toString('latin1'),
            )),
          watchtowerClients:
            wtClient?.enabled === 'enabled' ? wtClient['add-watchtowers'] : [],
        })

        await rm('/media/startos/volumes/main/start9', {
          recursive: true,
        }).catch(console.error)

        // Enforce backend bundle based on old config; carry over any
        // experimental-taproot-channels setting from the 0.3.5.x GUI.
        await lndConfFile.merge(effects, {
          externalhosts: undefined,
          ...(configYaml.bitcoind.type === 'internal'
            ? bitcoindBundle
            : neutrinoBundle),
          'protocol.simple-taproot-chans':
            configYaml.advanced?.['protocol-simple-taproot-chans'] || undefined,
        })
      }
    },
    down: IMPOSSIBLE,
  },
})
