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

export const v_0_20_1_beta_9 = VersionInfo.of({
  version: '0.20.1-beta:9',
  releaseNotes: {
    en_US: `- Tor configuration moved to its own **Tor Settings** action. Enable Tor (on by default) with an optional sub-setting to skip the Tor proxy for clearnet-reachable peers (on by default for new installs).
- Tor is now a required running dependency whenever Tor is enabled.`,
    es_ES: `- La configuración de Tor se trasladó a su propia acción **Configuración de Tor**. Habilitar Tor (activado de forma predeterminada) con una subopción para omitir el proxy Tor en los pares accesibles por clearnet (activada de forma predeterminada en instalaciones nuevas).
- Tor ahora es una dependencia de ejecución requerida siempre que Tor esté habilitado.`,
    de_DE: `- Die Tor-Konfiguration wurde in eine eigene Aktion **Tor-Einstellungen** verschoben. Tor aktivieren (standardmäßig an) mit einer optionalen Unteroption, um den Tor-Proxy für über Clearnet erreichbare Peers zu überspringen (bei Neuinstallationen standardmäßig an).
- Tor ist jetzt eine erforderliche laufende Abhängigkeit, wenn Tor aktiviert ist.`,
    pl_PL: `- Konfiguracja Tora została przeniesiona do osobnej akcji **Ustawienia Tor**. Włącz Tor (domyślnie włączone) z opcjonalnym podustawieniem, aby pomijać proxy Tor dla peerów osiągalnych w clearnecie (w nowych instalacjach domyślnie włączone).
- Tor jest teraz wymaganą uruchomioną zależnością, gdy Tor jest włączony.`,
    fr_FR: `- La configuration de Tor a été déplacée dans sa propre action **Paramètres Tor**. Activer Tor (activé par défaut) avec un sous-paramètre optionnel pour contourner le proxy Tor pour les pairs accessibles sur clearnet (activé par défaut pour les nouvelles installations).
- Tor est désormais une dépendance d'exécution requise dès que Tor est activé.`,
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
