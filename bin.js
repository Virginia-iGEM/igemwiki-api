#!/usr/bin/env node

const path = require('path')
const cli = require('cli')
const Promise = require('bluebird')
const globby = require('globby')

const igemwikiEntry = require('./index.js')

const program = process.argv[2]

const baseOptions = {
  year: [ 'y', 'Year to download pages from', 'int', new Date().getFullYear() ],
  teamName: [ 'n', 'Team name', 'string', undefined ],
}

const programs = {
  backup: {
    options: {
      dir: [ 'd', 'Download directory', 'dir', './backups' ]
    },
    main(igemwiki, { dir }) {
      igemwiki.downloadAll({ dir })
        .then(results => console.log('Download results: ', results))
        .catch((err) => {
          console.error(err)
          process.exit(1)
        })
    }
  },
  upload: {
    options: {
      source: [ 's', 'Source file', 'string' ],
      dest: [ 'd', 'Destination', 'string' ],
      type: [ 't', 'Type (page, template, stylesheet, script, or image)', 'string' ],
      force: [ 'f', 'Force upload', 'bool', false ]
    },
    main(igemwiki, { type, source, dest, force }) {
      igemwiki.login().then(jar => igemwiki.upload({
        jar,
        type,
        source,
        dest,
        force
      })).catch(console.error)
    }
  },
  ['upload-glob']: {
    options: {
      glob: [ 'g', 'Glob pattern for sources', 'string' ],
      type: [ 't', 'Type (page, template, stylesheet, script, or image)', 'string' ],
      force: [ 'f', 'Force upload', 'bool', false ]
    },
    main(igemwiki, { glob, type, force }) {
      const makeDest = (source) => {
        source = path.basename(source)

        if (type === 'page' || type === 'template') {
          source = source.replace(/\.html$/, '')
        } else if (type === 'stylesheet') {
          source = source.replace(/\.css$/, '')
        } else if (type === 'script') {
          source = source.replace(/\.js$/, '')
        }

        return source
      }

      Promise.all([
        globby([ glob ])
          .then(files => files.map(file => ({
            type,
            source: file,
            dest: makeDest(file),
            force
          }))),
        igemwiki.login()
      ]).then(([ opts, jar ]) => opts.map(opt => Object.assign({}, opt, { jar })))
        .then(opts => Promise.map(opts, opt => igemwiki.upload(opt), { concurrency: 1 }))
        .then(() => console.log('Upload completed'))
        .catch(console.error)
    }
  }
}

// Check for valid sub program
if (Object.keys(programs).indexOf(program) === -1) {
  console.log(`Usage: igemwiki <program> [-h] where program is one of [ ${Object.keys(programs)} ]`)
  process.exit(1)
}
const subProgram = programs[program]

// Check for teamName
const options = cli.parse(Object.assign({}, baseOptions, subProgram.options))
const { year, teamName } = options

if (teamName === undefined) {
  console.log('Must provide a team name, use -n or --team')
  process.exit(1)
}

// Run sub program with igemwiki instance and options
subProgram.main(igemwikiEntry({ year, teamName }), options)

