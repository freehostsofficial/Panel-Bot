const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder,
  ComponentType
} = require('discord.js');
const db = require('../../../../Functions/database');
const ptero = require('../../../../Functions/pteroService');
const pteroUtils = require('../../../../Functions/pteroUtils');
const { handleApiError } = require('../../../../Functions/errorHandler');

module.exports = {
  name: 'list',
  description: 'Interactive dashboard for instance monitoring and control.',
  category: 'Server',
  data: new SlashCommandBuilder()
    .setName('list')
    .setDescription('Interactive dashboard for instance monitoring and control.')
    .addStringOption(opt =>
      opt.setName('panel')
        .setDescription('Specific panel to list (Search all if omitted)')
        .setRequired(false)
        .setAutocomplete(true)
    ),

  async autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused().toLowerCase();
    const userData = await db.getUserData(interaction.user.id);
    const panels = userData.panels || [];
    const filtered = panels.filter(p => p.name.toLowerCase().includes(focusedValue));
    await interaction.respond(filtered.map(p => ({ name: p.name, value: p.name })));
  },

  async execute(client, interaction) {
    const userId = interaction.user.id;
    const panelName = interaction.options.getString('panel');
    const userData = await db.getUserData(userId);

    if (!userData.panels || userData.panels.length === 0) {
      return interaction.reply({ content: "❌ You haven't added any panels yet.", ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    let servers;
    try {
      const allServers = await pteroUtils.getUserServers(userId);
      servers = panelName
        ? allServers.filter(s => s.panel.name === panelName)
        : allServers;
    } catch (err) {
      const errorEmbed = handleApiError(err, 'Server Manager', 'fetch servers');
      return interaction.editReply({ embeds: [errorEmbed] });
    }

    if (!servers || servers.length === 0) {
      return interaction.editReply('❌ No servers found across your registered panels.');
    }

    const pageSize = 5;
    let currentPage = 0;
    const totalPages = Math.ceil(servers.length / pageSize);

    const statusConfig = {
      running: { emoji: '🟢', color: '#2ECC71', name: 'Running' },
      offline: { emoji: '🔴', color: '#E74C3C', name: 'Offline' },
      starting: { emoji: '🟠', color: '#E67E22', name: 'Starting' },
      stopping: { emoji: '🟡', color: '#F1C40F', name: 'Stopping' },
      suspended: { emoji: '🛑', color: '#000000', name: 'Suspended' }
    };

    let refreshInterval = null;
    let activeServerId = null;
    let activePanel = null;

    const clearRefresh = () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
      }
    };

    const buildListPage = async (pageIndex) => {
      clearRefresh();
      activeServerId = null;
      activePanel = null;
      const slice = servers.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize);
      const title = panelName ? `📋 ${panelName} — Servers` : '📋 My Servers — All Panels';

      const embed = new EmbedBuilder()
        .setTitle(`${title} (${pageIndex + 1}/${totalPages})`)
        .setColor('#5865F2')
        .setDescription('Select a server to manage or use buttons to navigate.')
        .setFooter({ text: `Showing ${pageIndex * pageSize + 1}-${Math.min((pageIndex + 1) * pageSize, servers.length)} of ${servers.length}` })
        .setTimestamp();

      const selectOptions = [];

      for (const srv of slice) {
        const attr = srv.attributes;
        const panel = srv.panel;
        const memLimit = attr.limits.memory === 0 ? '∞' : `${attr.limits.memory}MB`;
        const cpuLimit = attr.limits.cpu === 0 ? '∞' : `${attr.limits.cpu}%`;

        const statusEmoji = attr.is_suspended ? '🛑' : '⚪';

        embed.addFields({
          name: `${statusEmoji} ${attr.name}`,
          value: `\`\`\`yml\nPanel: ${panel.name}\nID: ${attr.identifier}\nRAM: ${memLimit}\nCPU: ${cpuLimit}\n\`\`\``,
          inline: true
        });

        selectOptions.push({
          label: attr.name.substring(0, 25),
          description: `ID: ${attr.identifier} | Panel: ${panel.name}`,
          value: `${panel.name}:${attr.identifier}`,
          emoji: '🖥️'
        });
      }

      const navRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('prev')
          .setEmoji('⬅️')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(pageIndex === 0),
        new ButtonBuilder()
          .setCustomId('page_info')
          .setLabel(`${pageIndex + 1}/${totalPages}`)
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId('next')
          .setEmoji('➡️')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(pageIndex >= totalPages - 1)
      );

      const selectRow = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('select_srv')
          .setPlaceholder('Select a server to manage...')
          .addOptions(selectOptions)
      );

      return { embeds: [embed], components: [selectRow, navRow] };
    };

    const buildDetailView = async (combinedId) => {
      const pName = pteroUtils.extractPanelName(combinedId);
      const srvId = pteroUtils.extractServerId(combinedId);
      const panel = userData.panels.find(p => p.name === pName);
      activeServerId = srvId;
      activePanel = panel;

      const info = await ptero.getServerInfo(panel.url, panel.apikey, srvId);
      const res = info.resources;
      const state = res.current_state;
      const cfgSt = statusConfig[state] || { emoji: '⚪', color: '#95A5A6', name: state };

      const memUsed = (res.resources.memory_bytes / 1024 / 1024).toFixed(1);
      const memLimit = info.limits.memory === 0 ? '∞' : `${info.limits.memory}MB`;
      const cpuUsed = res.resources.cpu_absolute.toFixed(1);
      const cpuLimit = info.limits.cpu === 0 ? '∞' : `${info.limits.cpu}%`;
      const diskUsed = (res.resources.disk_bytes / 1024 / 1024).toFixed(1);
      const diskLimit = info.limits.disk === 0 ? '∞' : `${info.limits.disk}MB`;

      const embed = new EmbedBuilder()
        .setTitle(`${cfgSt.emoji} ${info.name}`)
        .setColor(cfgSt.color)
        .setDescription(`Managing server \`${srvId}\` on **${panel.name}**\n*(Auto-refreshing every 5s)*`)
        .addFields(
          { name: '🆔 ID', value: `\`${srvId}\``, inline: true },
          { name: '📊 Status', value: cfgSt.name, inline: true },
          { name: '🌐 Panel', value: panel.name, inline: true },
          { name: '⚡ CPU', value: `\`${cpuUsed}% / ${cpuLimit}\``, inline: true },
          { name: '💾 RAM', value: `\`${memUsed}MB / ${memLimit}\``, inline: true },
          { name: '💿 Disk', value: `\`${diskUsed}MB / ${diskLimit}\``, inline: true },
          { name: '⏱️ Uptime', value: res.uptime ? `${Math.floor(res.uptime / 3600)}h ${Math.floor((res.uptime % 3600) / 60)}m` : 'Offline', inline: true },
          { name: '📡 Network', value: `↓ ${(res.resources.network_rx_bytes / 1024 / 1024).toFixed(2)}MB\n↑ ${(res.resources.network_tx_bytes / 1024 / 1024).toFixed(2)}MB`, inline: true }
        )
        .setFooter({ text: `Sync: ${new Date().toLocaleTimeString()} • Auto-refresh active` })
        .setTimestamp();

      const isOffline = state === 'offline' || state === 'stopped' || !state;

      const powerRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`act_start_${combinedId}`).setLabel('Start').setEmoji('🚀').setStyle(ButtonStyle.Success).setDisabled(!isOffline),
        new ButtonBuilder().setCustomId(`act_stop_${combinedId}`).setLabel('Stop').setEmoji('⏹️').setStyle(ButtonStyle.Danger).setDisabled(isOffline),
        new ButtonBuilder().setCustomId(`act_restart_${combinedId}`).setLabel('Restart').setEmoji('🔄').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`act_kill_${combinedId}`).setLabel('Kill').setEmoji('☠️').setStyle(ButtonStyle.Danger)
      );

      const utilRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`act_refresh_${combinedId}`).setLabel('Refresh').setEmoji('🔁').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('back_to_list').setLabel('Back to List').setEmoji('📋').setStyle(ButtonStyle.Secondary)
      );

      return { embeds: [embed], components: [powerRow, utilRow] };
    };

    const initial = await buildListPage(0);
    const msg = await interaction.editReply(initial);

    const collector = msg.createMessageComponentCollector({ time: 600000 });

    const startAutoRefresh = (combinedId) => {
      clearRefresh();
      refreshInterval = setInterval(async () => {
        if (`${activePanel?.name}:${activeServerId}` !== combinedId) {
          return clearRefresh();
        }
        try {
          const detail = await buildDetailView(combinedId);
          await interaction.editReply(detail);
        } catch (err) {
          clearRefresh();
        }
      }, 5000);
    };

    collector.on('collect', async (i) => {
      if (i.user.id !== interaction.user.id) {
        return i.reply({ content: '❌ Not your session.', ephemeral: true });
      }

      try {
        if (i.customId === 'next') {
          currentPage++;
          await i.update(await buildListPage(currentPage));
        } else if (i.customId === 'prev') {
          currentPage--;
          await i.update(await buildListPage(currentPage));
        } else if (i.customId === 'select_srv') {
          await i.deferUpdate();
          const combinedId = i.values[0];
          await i.editReply(await buildDetailView(combinedId));
          startAutoRefresh(combinedId);
        } else if (i.customId === 'back_to_list') {
          await i.update(await buildListPage(currentPage));
        } else if (i.customId.startsWith('act_')) {
          const parts = i.customId.split('_');
          const action = parts[1];
          const combinedId = parts.slice(2).join('_');
          const pName = pteroUtils.extractPanelName(combinedId);
          const srvId = pteroUtils.extractServerId(combinedId);
          const panel = userData.panels.find(p => p.name === pName);

          if (action === 'refresh') {
            await i.deferUpdate();
            await i.editReply(await buildDetailView(combinedId));
          } else {
            await i.deferUpdate();
            await ptero.sendPowerAction(panel.url, panel.apikey, srvId, action);
            setTimeout(async () => {
              try {
                if (`${activePanel?.name}:${activeServerId}` === combinedId) {
                  await i.editReply(await buildDetailView(combinedId));
                }
              } catch { }
            }, 1000);
          }
        }
      } catch (err) {
        const errorEmbed = handleApiError(err, 'Interactions', 'process button/menu');
        await i.followUp({ embeds: [errorEmbed], ephemeral: true });
      }
    });

    collector.on('end', () => {
      clearRefresh();
      interaction.editReply({ components: [] }).catch(() => { });
    });
  }
};
