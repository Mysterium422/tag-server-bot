// FIND PACKAGES
const Discord = require('discord.js')
const tagClient = new Discord.Client({partials: ["MESSAGE", "CHANNEL", "REACTION"]})
// const db = require('quick.db');
const fs = require('fs');
const yaml = require('js-yaml')
const schedule = require('node-schedule');


// FETCH UNUSED BUT WORKS FOR FUTURE
const { hypixelFetch, plotzesFetch, fetch } = require('./mystFetch.js')

// SETUP CONFIG
let tagConfig = yaml.loadAll(fs.readFileSync('config.yaml', 'utf8'))[2]

console.log(tagConfig)

const package = JSON.parse(fs.readFileSync('package.json'))


// HELPER OBJECTS
const embedFooter = {
        text: ['TNT Stats Bot by Mysterium_', 'TNT Stats Bot by Mysterium_', 'TNT Stats Bot by Mysterium_', 'Created by Mysterium_', 'Created by Mysterium_', 'Created by Mysterium_', 'Invite this bot to your own server! (/invite)', 'Invite this bot to your own server! (/invite)', 'Invite this bot to your own server! (/invite)', 'Invite this bot to your own server! (/invite)', 'Invite this bot to your own server! (/invite)', 'Wizard Leaderboard Bot! (/discord)', 'Suggest fixes! (/discord)', 'Join the discord! (/discord)', 'All bow to sensei Kidzyy', 'Check out my code! (/source)', `Version: ${package.version}`, 'Report any bugs! (/discord)'],
        image: {
            'green': 'https://cdn.discordapp.com/emojis/722990201307398204.png?v=1',
            'red':   'https://cdn.discordapp.com/emojis/722990201302941756.png?v=1'
        }
}

var tagQueues = {}
tagQueues[tagConfig.soloChannelID] = []
tagQueues[tagConfig.duoChannelID] = []
tagQueues[tagConfig.teamChannelID] = []
var tagQueueLimits = {};
tagQueueLimits[tagConfig.soloChannelID] = 1;
tagQueueLimits[tagConfig.duoChannelID] = 2;
tagQueueLimits[tagConfig.teamChannelID] = 4;
var tagParties = {}
var tagPartyInvites = {}
var tagQueueJoins = {}

async function memberExistsInTagGuild(guild, id) {
    var exists = true;
    try { await guild.members.fetch(id) } catch { exists = false }
    return exists;
}
async function generateTagTeams(players, limit) {
    var partiedPlayers = {}
    for (let u = 0; u<players.length; u++) {
        let partyID = findParty(players[u])
        if (partyID in partiedPlayers) {
            partiedPlayers[partyID].push(players[u])
        }
        else {
            partiedPlayers[partyID] = [players[u]]
        }
    }
    if (0 in partiedPlayers) {
        var nonPartiedPlayers = partiedPlayers[0]
        delete partiedPlayers[0]
    }
    else {
        var nonPartiedPlayers = []
    }
    var teamA = []
    var teamB = []
    var teamALeft = limit
    var teamBLeft = limit

    for (party in partiedPlayers) {
        let APossible = (limit - teamA.length >= partiedPlayers[party].length)
        let BPossible = (limit = teamB.length >= partiedPlayers[party].length)

        if (APossible && BPossible) {
            if (randInt(1, 2) == 1) {
                teamA = teamA.concat(partiedPlayers[party])
                delete partiedPlayers[party]
            }
            else {
                teamB = teamB.concat(partiedPlayers[party])
                delete partiedPlayers[party]
            }
        }
        else if (APossible) {
            teamA = teamA.concat(partiedPlayers[party])
            delete partiedPlayers[party]
        }
        else if (BPossible) {
            teamB = teamB.concat(partiedPlayers[party])
            delete partiedPlayers[party]
        }
        else {
            nonPartiedPlayers = nonPartiedPlayers.concat(partiedPlayers[party])
            delete partiedPlayers[party]
            continue;
        }
    }


    nonPartiedPlayers = shuffle(nonPartiedPlayers)

    teamA = teamA.concat(nonPartiedPlayers.splice(0, limit - teamA.length))
    teamB = teamB.concat(nonPartiedPlayers)


    return {"A":teamA, "B":teamB}
}

function shuffle(array) {
    var currentIndex = array.length, temporaryValue, randomIndex;
  
    // While there remain elements to shuffle...
    while (0 !== currentIndex) {
  
      // Pick a remaining element...
      randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex -= 1;
  
      // And swap it with the current element.
      temporaryValue = array[currentIndex];
      array[currentIndex] = array[randomIndex];
      array[randomIndex] = temporaryValue;
    }
  
    return array;
  }

function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1) + min)
}

function findParty(player) {
    if (player in tagParties) return player;
    for (party in tagParties) {
        if (tagParties[party].includes(player)) {
            return party
        }
    }
    return 0;
}

function inParty(player) {
    var partyLeaders = Object.keys(tagParties)
    var partyPlayers = partyLeaders

    for(let i = 0; i < partyLeaders.length; i++) {
        partyPlayers = partyPlayers.concat(tagParties[partyLeaders[i]])
    }

    return partyPlayers.includes(player)
}

function inGame(player) {
    var gameKeys = Object.keys(tagQueues)
    var gamePlayers = []

    for(let i = 0; i < gameKeys.length; i++) {
        gamePlayers = gamePlayers.concat(tagQueues[gameKeys[i]])
    }

    return gamePlayers.includes(player)
}

function timeConverter(UNIX_timestamp){
    var a = new Date(UNIX_timestamp * 1000);
    var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    var year = a.getFullYear();
    var month = months[a.getMonth()];
    var date = a.getDate();
    var hour = a.getHours();
    var min = a.getMinutes() < 10 ? '0' + a.getMinutes() : a.getMinutes()
    var sec = a.getSeconds() < 10 ? '0' + a.getSeconds() : a.getSeconds()
    var time = date + ' ' + month + ' ' + year + ' ' + hour + ':' + min + ':' + sec ;
    return time;
  }
  console.log(timeConverter(0));

tagClient.on('ready', async () => {
    console.log('Bot: Tag Server Bot is online!');
    tagClient.user.setActivity("Jonful tell Myst what to put here pls");

    schedule.scheduleJob('0 0 * * * *', async function() {
        
        console.log("Updating Tag ppl")

        let tagGuild = await tagClient.guilds.cache.get(tagConfig.tagGuildID)
        let penaltiesGiven = JSON.parse(fs.readFileSync('penalties.json'))
        let penaltiesGivenKeys = Object.keys(penaltiesGiven)
        let yellowCardRole = await tagGuild.roles.cache.get(tagConfig.yellowCardRoleID)
        let redCardRole = await tagGuild.roles.cache.get(tagConfig.redCardRoleID)
        for (let k = 0; k < penaltiesGivenKeys; k++) {
            if (Date.now() - penaltiesGiven[penaltiesGivenKeys[i]] > 4 * 7 * 24 * 60 * 60 * 1000) {
                let tagMember = await tagGuild.members.fetch(penaltiesGivenKeys[i])
                if (tagMember.roles.cache.has(tagConfig.yellowCardRoleID)) {
                    tagMember.roles.remove(yellowCardRole)
                }
                if (tagMember.roles.cache.has(tagConfig.redCardRoleID)) {
                    if (Date.now() - penaltiesGiven[penaltiesGivenKeys[i]] > 6 * 7 * 24 * 60 * 60 * 1000) {
                        tagMember.roles.remove(redCardRole)
                    }
                }
            }
        }
    })
    schedule.scheduleJob('0 */5 * * * *', async function() {
        
        console.log("Updating Tag ppl (Kicking inactives)")

        for (user in tagQueueJoins) {
            if (Date.now() - tagQueueJoins[user][0] > 60 * 60 * 1000) {
                if (tagQueues[tagQueueJoins[user][1]].includes(user)) {
                    let tagChannel = await tagClient.channels.fetch(tagQueueJoins[user][1])
                    tagChannel.send(`<@!${user}> was removed from the queue after remaining in it for over an hour`)
                }
                delete tagQueueJoins[user]
            }
        }
    })
});

tagClient.on('message', async m => {

    //console.log(m)

    if(m.author.bot) return;

    if(m.channel.id == tagConfig.ignChannelID) {
        m.member.setNickname(m.content).catch(() => m.channel.send("I need permissions"))
        return
    }

    var prefix = "="
    if(!m.content.startsWith(prefix)) return

    var args = m.content.toLowerCase().slice(prefix.length).split(' ');
    const command = args.shift().toLowerCase()

    console.log(m.author.username+": " + m.content)
    if (command == "help") {
        m.channel.send(`Ugliest Help Msg Ever
Will Work here:
=j or =join
=l or =leave
=p invite or =p i
=p leave
=p kick
=p list
=p disband
Setting IGNs in #ign
=queue or =q
=setplayercount

Implemented but wont work here
=green
=yellow
=red`)
    }
    else if (command == "yellow") {
        if (!(m.member.roles.cache.has(tagConfig.adminRoleID) || m.member.roles.cache.has(tagConfig.moderatorRoleID))) {
            return;
        }

        if (m.mentions.users.size == 0) {
            return m.channel.send("No users in the server were specified")
        }

        let tagGuild = await tagClient.guilds.cache.get(tagConfig.tagGuildID)
        let yellowCardRole = await tagGuild.roles.cache.get(tagConfig.yellowCardRoleID)
        let redCardRole = await tagGuild.roles.cache.get(tagConfig.redCardRoleID)
        m.mentions.users.forEach(async (pinged) => {
            if (pinged.bot) { return m.channel.send("Unfortunately I refuse to give a penalty to my own kind!") }
            if (!(memberExistsInTagGuild(tagClient.guilds.cache.get(tagConfig.tagGuildID), pinged.id))) {
                return m.channel.send(`Player <@!${pinged.id}> is not in the guild :(`)
            }

            if (pinged.roles.cache.has(tagConfig.redCardRoleID)) {
                return m.channel.send("This player already has a red card!")
            }
            else if (pinged.roles.cache.has(tagConfig.yellowCardRoleID)) {
                pinged.roles.remove(yellowCardRole)
                pinged.roles.add(redCardRole)
                penaltiesGiven = JSON.parse(fs.readFileSync('penalties.json'))
                penaltiesGiven[m.author.id] = Date.now()
                fs.writeFileSync('penalties.json', JSON.stringify(penaltiesGiven))
                return m.channel.send(`Gave a red card to <@!${pinged.id}>`)
            }
            else {
                pinged.roles.add(yellowCardRole)
                penaltiesGiven = JSON.parse(fs.readFileSync('penalties.json'))
                penaltiesGiven[m.author.id] = Date.now()
                fs.writeFileSync('penalties.json', JSON.stringify(penaltiesGiven))
                return m.channel.send(`Gave a yellow card to <@!${pinged.id}>`)
            }
        })
    }

    else if (command == "red") {
        if (!(m.member.roles.cache.has(tagConfig.adminRoleID) || m.member.roles.cache.has(tagConfig.moderatorRoleID))) {
            return;
        }

        if (m.mentions.users.size == 0) {
            return m.channel.send("No users in the server were specified")
        }

        let tagGuild = await tagClient.guilds.cache.get(tagConfig.tagGuildID)
        let yellowCardRole = await tagGuild.roles.cache.get(tagConfig.yellowCardRoleID)
        let redCardRole = await tagGuild.roles.cache.get(tagConfig.redCardRoleID)
        m.mentions.users.forEach(async (pinged) => {
            if (pinged.bot) { return m.channel.send("Unfortunately I refuse to give a penalty to my own kind!") }
            if (!(memberExistsInTagGuild(tagClient.guilds.cache.get(tagConfig.tagGuildID), pinged.id))) {
                return m.channel.send(`Player <@!${pinged.id}> is not in the guild :(`)
            }

            if (pinged.roles.cache.has(tagConfig.yellowCardRoleID)) {
                pinged.roles.remove(yellowCardRole)
            }
            if (pinged.roles.cache.has(tagConfig.redCardRoleID)) {
                return m.channel.send("This player already has a red card!")
            }
            pinged.roles.add(redCardRole)
            penaltiesGiven = JSON.parse(fs.readFileSync('penalties.json'))
            penaltiesGiven[m.author.id] = Date.now()
            fs.writeFileSync('penalties.json', JSON.stringify(penaltiesGiven))
            return m.channel.send(`Gave a yellow card to <@!${pinged.id}>`)
        })
    }

    else if (command == "green") {
        if (!(m.member.roles.cache.has(tagConfig.adminRoleID) || m.member.roles.cache.has(tagConfig.moderatorRoleID))) {
            return;
        }

        if (m.mentions.users.size == 0) {
            return m.channel.send("No users in the server were specified")
        }

        let tagGuild = tagClient.guilds.cache.get(tagConfig.tagGuildID)
        let yellowCardRole = await tagGuild.roles.cache.get(tagConfig.yellowCardRoleID)
        let redCardRole = await tagGuild.roles.cache.get(tagConfig.redCardRoleID)
        m.mentions.users.forEach(async (pinged) => {
            if (pinged.bot) { return m.channel.send("Unfortunately I refuse to give a penalty to my own kind!") }
            if (!(memberExistsInTagGuild(tagClient.guilds.cache.get(tagConfig.tagGuildID), pinged.id))) {
                return m.channel.send(`Player <@!${pinged.id}> is not in the guild :(`)
            }

            if (pinged.roles.cache.has(tagConfig.yellowCardRoleID)) {
                pinged.roles.remove(yellowCardRole)
                pinged.roles.remove(redCardRole)
                penaltiesGiven = JSON.parse(fs.readFileSync('penalties.json'))
                delete penaltiesGiven[m.author.id]
                fs.writeFileSync('penalties.json', JSON.stringify(penaltiesGiven))
                return m.channel.send("Penatlies Removed!")

            }
            if (pinged.roles.cache.has(tagConfig.redCardRoleID)) {
                pinged.roles.remove(yellowCardRole)
                pinged.roles.remove(redCardRole)
                penaltiesGiven = JSON.parse(fs.readFileSync('penalties.json'))
                delete penaltiesGiven[m.author.id]
                fs.writeFileSync('penalties.json', JSON.stringify(penaltiesGiven))
                return m.channel.send("Penalties Removed!")
            }
        })
    }

    let tagChannels = [tagConfig.soloChannelID, tagConfig.duoChannelID, tagConfig.teamChannelID]
    if (!tagChannels.includes(m.channel.id)) return;
    if (command == 'queue' || command == 'q') {
        if(tagQueues[m.channel.id].length == 0) {
            return m.channel.send("No one in this queue")
        }

        responseOutput = await m.channel.send(`Loading...`)
        response = `**Game Queue**
Creator: `
        for (let i = 0; i < tagQueues[m.channel.id].length; i++) {
            response = `${response}<@!${tagQueues[m.channel.id][i]}>\n`
        }

        responseOutput.edit(response)
    }
    else if (command == 'join' || command == 'j') {

        if (args.length > 0) {
            let errorEmbed = new Discord.MessageEmbed()
            .setColor('#9c2c24')
            .setTitle('Error: Too many Arguments')
            .setDescription(`Use just ${prefix}j`)
            return m.channel.send(errorEmbed)
        }

        if(inGame(m.author.id)) return m.channel.send("You are already in a game")

        tagQueues[m.channel.id].push(m.author.id)
        tagQueueJoins[m.author.id] = [Date.now(), m.channel.id]

        /**const embed = new Discord.MessageEmbed()
        .setColor('#00BF00')
        .setAuthor(`${m.author.tag}`, `https://cdn.discordapp.com/avatars/${m.author.id}/${m.author.avatar}?size=128`)
        .setTitle(`Success! Channel Configured`)
        .setTimestamp()
        .setFooter(embedFooter.text[randInt(0, embedFooter.text.length - 1)], embedFooter.image.green)
        .addField(`__Default Game:__`, configurationTool[args[0]], true)
        .addField(`__Bot Prefix:__`, args[1], true)
        return m.channel.send(embed)*/

        let outputEmbed = new Discord.MessageEmbed()
        .setColor('#3bcc71')
        .setDescription(`[${tagQueues[m.channel.id].length}/${tagQueueLimits[m.channel.id]*2}] <@!${m.author.id}> joined the queue.`)

        m.channel.send(outputEmbed)

        if(tagQueues[m.channel.id].length > tagQueueLimits[m.channel.id]*2-1) {
            let gameCounters = await JSON.parse(fs.readFileSync('tagGameCounts.json'))
            gameCounters[m.channel.id] = gameCounters[m.channel.id] + 1
            fs.writeFileSync('tagGameCounts.json', JSON.stringify(gameCounters))

            let outputEmbed = new Discord.MessageEmbed()
            .setColor('#3498db')
            .setTitle(`Game #${gameCounters[m.channel.id]}`)
            .setDescription(`**Creation Time:** ${timeConverter(Math.floor(Date.now()/1000))}
**Lobby:** <#${m.channel.id}>`)
            var teams = await generateTagTeams(tagQueues[m.channel.id], tagQueueLimits[m.channel.id])
            var aString = ""
            var bString = ""
            for (let g = 0; g < teams.A.length; g++) {
                aString = `${aString}\n<@!${teams.A[g]}>`
            }
            for (let g = 0; g < teams.B.length; g++) {
                bString = `${bString}\n<@!${teams.B[g]}>`
            }

            outputEmbed.addField('**Team 1**', aString)
            .addField('**Team 2**', bString)
            let outputPingText = "";
            for (let j = 0; j < tagQueues[m.channel.id].length; j++) {
                outputPingText = `${outputPingText}<@!${tagQueues[m.channel.id][j]}> `
            }
            m.channel.send(outputPingText, {embed: outputEmbed})
            tagQueues[m.channel.id] = []
        }
    }
    else if (command == "setplayercount") {
        if (m.channel.id !== tagConfig.teamChannelID) return;

        if (!m.author.id !== tagQueues[m.channel.id][0]) return m.channel.send("You did not create this game")
        if (!args[0].isFinite()) return m.channel.send("Specify a numebr")

        tagQueueLimits[m.channel.id] = args[0]
    }
    else if (command == "leave" || command == "l") {
        if (args.length > 0) {
            let errorEmbed = new Discord.MessageEmbed()
            .setColor('#9c2c24')
            .setTitle('Error: Too many Arguments')
            .setDescription(`Use just ${prefix}l`)
            return m.channel.send(errorEmbed)
        }

        if(!inGame(m.author.id)) return m.channel.send("You are not in any game")

        if (tagQueues[m.channel.id].indexOf(m.author.id) > -1) {
            tagQueues[m.channel.id].splice(tagQueues[m.channel.id].indexOf(m.author.id))
            return m.channel.send("You have left the game")
        }
        else {
            return m.channel.send("You are not in *this* game")
        }
    }

    if (command == "party" || command == "p") {
        if (args[0] == "invite" || args[0] == "i") {
            if (m.mentions.users.size == 0) {
                return m.channel.send("No users in the guild were specified")
            }
            if (inParty(m.author.id) && !(m.author.id in tagQueues)) return m.channel.send("Insufficient Permissions")
            let tagGuild = await tagClient.guilds.cache.get(tagConfig.tagGuildID)
            m.mentions.users.forEach(async (pinged) => {
                if (pinged.bot) { return m.channel.send("You cant invite bots!") }
                if (pinged.id == m.author.id) return m.channel.send("You cant invite yourself!")
                if (!(memberExistsInTagGuild(tagClient.guilds.cache.get(tagConfig.tagGuildID), pinged.id))) {
                    return m.channel.send(`Player <@!${pinged.id}> is not in the guild :(`)
                }
                if (inParty(pinged.id)) {
                    return m.channel.send(`Player ${pinged.tag} is already in a party!`)
                }
                let message = await m.channel.send(`<@!${pinged.id}> Click the check mark below to join <@!${m.author.id}>'s party`)
                tagPartyInvites[message.id] = [m.author.id, pinged.id]
                await message.react('✅')
                await message.react('❌')
                setTimeout(async function () {
                    messageDeleted = true

                    let channelMsgDelete = await tagClient.channels.fetch(m.channel.id)
                    let messageDelete = ""
                    messageDelete = await channelMsgDelete.messages.fetch(message.id).catch((err) => {return messageDelete = null})
                    if (!messageDeleted) {
                        delete tagPartyInvites[message.id]
                        m.channel.send("Party Invite Expired")
                        messageDelete.delete()
                    }
                }, 10 * 1000);
            })
        }
        else if (args[0] == "disband") {
            if (m.author.id in tagParties) {
                delete tagParties[m.author.id]
                m.channel.send("You have disbanded the party")
            }
            else if (inParty(m.author.id)) {
                m.channel.send("You do not have permission")
            }
            else {
                m.channel.send("You are not in a party")
            }
            return;
        }
        else if (args[0] == "leave") {
            if (!inParty(m.author.id)) return m.channel.send("You are not in a party")

            if (m.author.id in tagParties) {
                m.channel.send(`<@!${m.author.id}> has left the party`)
                if (tagParties[m.author.id].length == 1) {
                    delete tagParties[m.author.id]
                    return m.channel.send(`Party has been disbanded`)
                }
                else {
                    tagParties[tagParties[m.author.id][0]] = tagParties[m.author.id]
                    tagParties[tagParties[m.author.id][0]].shift()
                    m.channel.send(`Party ownership has transfered over to ${tagParties[m.author.id][0]}`)
                    return delete tagParties[m.author.id]

                }    
            }
            else {
                for (let u = 0; u < Object.keys(tagParties); u++) {
                    if (tagParties[Object.keys(tagParties)[u]].includes(m.author.id)) {
                        tagParties[Object.keys(tagParties)[u]].splice(tagParties[Object.keys(tagParties)[u]].indexOf(m.author.id))
                        m.channel.send(`<@!${m.author.id}> has left the party`)
                        break;
                    }
                }
            }
        }
        else if (args[0] == "kick") {
            if (!inParty(m.author.id)) return m.channel.send("You are not in a party")

            if (!(m.author.id in tagParties)) {
                return m.channel.send("You do not have permission")
            }

            m.mentions.users.forEach(async (pinged) => {
                if (!tagParties[m.author.id].includes(pinged.id)) return m.channel.send("Player is not in the party")

                tagParties[m.author.id].splice(tagParties[m.author.id].indexOf(pinged.id))
                m.channel.send(`<@!${pinged.id}> was kicked from the party`)
            })

            if (tagParties[m.author.id].length == 0) {
                delete tagParties[m.author.id]
                return m.channel.send(`Party has been disbanded`)
            }
        }
        else if (args[0] == "list") {
            if (!inParty(m.author.id)) return m.channel.send("You are not in a party")

            if (m.author.id in tagParties) {
                responseOutput = await m.channel.send(`Loading...`)
                response = `**Party Owner**
<@!${m.author.id}>

**Party Members**`
                for (let i = 0; i < tagParties[m.author.id].length; i++) {
                    response = `${response}\n<@!${tagParties[m.author.id][i]}>`
                }

                responseOutput.edit(response)
            }
            else {
                tagPartiesKeys = Object.keys(tagParties)
                for (let u = 0; u < tagPartiesKeys; u++) {
                    if (tagParties[tagPartiesKeys[u]].includes(m.author.id)) {
                        responseOutput = await m.channel.send(`Loading...`)
                        response = `**Party Owner**
<@!${tagPartiesKeys[u]}>
        
**Party Members**`
                        for (let i = 0; i < tagParties[tagPartiesKeys[u]].length; i++) {
                            response = `${response}\n<@!${tagParties[tagPartiesKeys[u]][i]}>`
                        }
        
                        responseOutput.edit(response)
                        break;
                    }
                }
            }
        }
    }
})

tagClient.on('messageReactionAdd', async (reaction, user) => {
    if (reaction.message.partial) await reaction.message.fetch()
    if (reaction.partial) await reaction.fetch()
    if (user.bot) return
    if (!reaction.message.guild) return;

    if (!(reaction.message.id in tagPartyInvites)) return;

    if (!(tagPartyInvites[reaction.message.id][1] == user.id)) return;

    let tagChannels = [tagConfig.soloChannelID, tagConfig.duoChannelID, tagConfig.teamChannelID]
    if (tagChannels.includes(reaction.message.channel.id)) {
        if (reaction.emoji.name === '✅') {
            reaction.message.delete()
            if (inParty(user.id)) {
                delete tagPartyInvites[reaction.message.id]
                return reaction.message.channel.send("You are already in a party")
            }
            reaction.message.channel.send(`<@!${user.id}> has joined <@!${tagPartyInvites[reaction.message.id][0]}>'s party`)
            if (tagPartyInvites[reaction.message.id][0] in tagParties) {
                tagParties[tagPartyInvites[reaction.message.id][0]].push(user.id)
            }
            else {
                tagParties[tagPartyInvites[reaction.message.id][0]] = [user.id]
            }
            console.log(tagParties)
            delete tagPartyInvites[reaction.message.id]
        }
        else if (reaction.emoji.name === '❌') {
            reaction.message.delete()
            delete tagPartyInvites[reaction.message.id]
            reaction.message.channel.send(`Sorry! <@!${user.id}> isn't interested!`)
        }
        return
    }

})

tagClient.login(tagConfig.TagBotToken);