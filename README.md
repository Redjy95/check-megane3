# Check Mégane 3

App para registar a manutenção de um **Renault Mégane III Grand Tour 1.5 dCi (motor K9K)**: mostra o que está em dia, o que está quase a vencer e o que já passou do prazo, por quilómetros e por tempo.

É uma app web (PWA): abre no browser, instala-se no ecrã principal do telemóvel e funciona sem internet.

**Abrir:** https://redjy95.github.io/check-megane3/

## O que faz

- **Início:** quilometragem atual, resumo dos itens vencidos e em atenção, km até à próxima revisão, custo total e alertas de manutenção.
- **Checklist:** cerca de 20 itens (óleo, filtros, correia de distribuição, travões, pneus, bateria…), cada um com o seu intervalo em km e/ou meses. Tocar num item regista quando foi feito.
- **Registar:** guarda uma manutenção com a data, os km, o custo, a oficina, as notas e os itens feitos. Os itens do checklist ficam atualizados automaticamente.
- **Histórico:** lista das manutenções, com exportação para CSV (abre no Excel em português) e backup/restauro dos dados.
- **Peças:**
  - **Peças:** referências e especificações (óleo, filtros, pastilhas…);
  - **Reset:** como repor a luz de serviço no painel ou por OBD2;
  - **Especificações:** dados técnicos do carro;
  - **O meu carro:** VIN, potência, código do motor, caixa e pressões dos pneus. O VIN é validado e identifica a carroçaria (Grand Tour, 5 portas, Coupé, CC);
  - **OBD:** liga a um adaptador ELM327 Bluetooth LE para ler e apagar códigos de avaria, ver a tensão da bateria e a temperatura do motor, e tentar ler os km. Há também uma app só para OBD: [megane3-obd](https://redjy95.github.io/megane3-obd/).

## Instalar no telemóvel

- **iPhone:** abrir o endereço no **Safari** → Partilhar → **Adicionar ao ecrã principal**.
- **Android:** abrir no **Chrome** → menu ⋮ → **Instalar app**.

## Os seus dados

- Tudo fica guardado **só no telemóvel**, no armazenamento do browser. Não há servidor nem conta.
- Se apagar os dados do browser, ou remover a app do ecrã principal no iPhone, os dados perdem-se. **Faça backup com regularidade:** ícone de download no topo, ou Histórico → Fazer backup. Para recuperar: Histórico → Restaurar.
- A app no ecrã principal, o Safari e o Bluefy têm dados **separados**. Para passar os dados de um para outro, use o backup.

## OBD (Bluetooth)

- É preciso um adaptador **ELM327 Bluetooth LE (BLE)**. Os de Bluetooth "clássico" não funcionam.
- **Android:** funciona no Chrome.
- **iPhone:** o Safari não permite Bluetooth em páginas web. É preciso abrir a app no browser **Bluefy** (gratuito na App Store).
- Usar **só com o carro parado**, com a ignição ligada.
- Muitos carros de 2010 não enviam o conta-km pelo OBD standard. Nesse caso a app avisa.

## Aviso

Os intervalos de manutenção, as referências de peças e os dados técnicos são **de referência**: vêm de catálogos de peças e de informação geral sobre o motor K9K, não da Renault. Confirme sempre no livro de manutenção do carro ou com um mecânico, sobretudo a **correia de distribuição** (a app avisa aos 90 000 km; a Renault indica cerca de 120 000 km ou 5 anos) e a **norma do óleo** (RN0720).

## Para quem mexe no código

Não há dependências nem passo de compilação: são ficheiros estáticos.

| Ficheiro | O que tem |
|---|---|
| `index.html` | Estrutura e estilos (CSS) de todos os ecrãs |
| `app.js` | Lógica da app: dados, checklist, alertas, histórico, backup, perfil do carro |
| `obd.js` | Ligação ao ELM327 por Web Bluetooth e leitura dos dados OBD |
| `sw.js` | Service worker: funcionamento offline e atualizações |
| `manifest.json` | Nome, cores e ícones da app instalada |
| `icon-*.png`, `apple-touch-icon.png` | Ícones |

**Testar localmente:**

```bash
python3 -m http.server 8000
# abrir http://localhost:8000
```

**Publicar uma atualização:**

1. Fazer as alterações.
2. **Subir a versão da cache** em `sw.js` (`const CACHE = 'megane3-v10'` → `v11`…), para os telemóveis receberem a versão nova.
3. Fazer merge para o `main`. O GitHub Pages publica sozinho em poucos minutos.
4. No telemóvel: abrir a app, fechá-la por completo e voltar a abrir.

O service worker pede sempre os ficheiros ao servidor (com a cópia guardada como alternativa offline). Assim o HTML e o JavaScript nunca ficam de versões diferentes. Só apaga as caches com o nome `megane3-v<número>`, para não mexer na cache da app OBD, que está no mesmo domínio.
