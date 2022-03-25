import {
  readdirSync,
  lstatSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  copyFileSync,
} from 'fs'
import { dirname, extname, join } from 'path'
import sharp from 'sharp'

import { templateDir } from '..'
import { config } from '../..'
import { CONFIGS_DIR, ENGINE_DIR } from '../../constants'
import {
  defaultBrandsConfig,
  ensureEmpty,
  filesExist,
  mkdirpSync,
  stringTemplate,
  walkDirectory,
} from '../../utils'

// =============================================================================
// Pure constants

export const BRANDING_DIR = join(CONFIGS_DIR, 'branding')
const BRANDING_STORE = join(ENGINE_DIR, 'browser', 'branding')
const BRANDING_FF = join(BRANDING_STORE, 'unofficial')

const REQUIRED_FILES = ['logo.png']

const CSS_REPLACE_REGEX = new RegExp(
  '#130829|hsla\\(235, 43%, 10%, .5\\)',
  'gm'
)

// =============================================================================
// Utility Functions

function checkForFaults(name: string, configPath: string) {
  if (!existsSync(configPath)) {
    throw new Error(`Branding ${name} does not exist`)
  }

  const requiredFiles = REQUIRED_FILES.map((file) => join(configPath, file))
  const requiredFilesExist = filesExist(requiredFiles)

  if (!requiredFilesExist) {
    throw new Error(
      `Missing some of the required files: ${requiredFiles
        .filter((file) => !existsSync(file))
        .join(', ')}`
    )
  }
}

function constructConfig(name: string) {
  return {
    brandingGenericName: config.name,
    brandingVendor: config.vendor,

    ...defaultBrandsConfig,
    ...(config.brands[name] || {}),
  }
}

async function setupImages(configPath: string, outputPath: string) {
  for (const size of [16, 22, 24, 32, 48, 64, 128, 256]) {
    await sharp(join(configPath, 'logo.png'))
      .resize(size, size)
      .toFile(join(outputPath, `default${size}.png`))
    await sharp(join(configPath, 'logo.png'))
      .resize(size, size)
      .toFile(join(configPath, `logo${size}.png`))
  }

  await sharp(join(configPath, 'logo.png'))
    .resize(512, 512)
    .toFile(join(outputPath, 'firefox.ico'))
  await sharp(join(configPath, 'logo.png'))
    .resize(64, 64)
    .toFile(join(outputPath, 'firefox64.ico'))

  mkdirSync(join(outputPath, 'content'), { recursive: true })

  await sharp(join(configPath, 'logo.png'))
    .resize(512, 512)
    .toFile(join(outputPath, 'content', 'about-logo.png'))
  await sharp(join(configPath, 'logo.png'))
    .resize(1024, 1024)
    .toFile(join(outputPath, 'content', 'about-logo@2x.png'))
}

function setupLocale(
  outputPath: string,
  brandingConfig: {
    backgroundColor: string
    brandShorterName: string
    brandShortName: string
    brandFullName: string
    brandingGenericName: string
    brandingVendor: string
  }
) {
  readdirSync(join(templateDir, 'branding.optional'))
    .map((file) => [
      readFileSync(join(templateDir, 'branding.optional', file), 'utf-8'),
      join(outputPath, 'locales/en-US', file),
    ])
    .forEach(([contents, path]) => {
      mkdirSync(dirname(path), { recursive: true })
      writeFileSync(path, stringTemplate(contents, brandingConfig))
    })
}

async function copyMozFiles(
  outputPath: string,
  brandingConfig: {
    backgroundColor: string
    brandShorterName: string
    brandShortName: string
    brandFullName: string
    brandingGenericName: string
    brandingVendor: string
  }
) {
  const files = (await walkDirectory(BRANDING_FF)).filter(
    (file) => !existsSync(join(outputPath, file.replace(BRANDING_FF, '')))
  )

  const css = files.filter((file) => extname(file).includes('css'))

  const everythingElse = files.filter((file) => !css.includes(file))

  css
    .map((filePath) => [
      readFileSync(filePath, 'utf-8'),
      join(outputPath, filePath.replace(BRANDING_FF, '')),
    ])
    .map(([contents, path]) => [
      contents.replace(CSS_REPLACE_REGEX, 'var(--theme-bg)') +
        `:root { --theme-bg: ${brandingConfig.backgroundColor} }`,
      path,
    ])
    .forEach(([contents, path]) => {
      mkdirSync(dirname(path), { recursive: true })
      writeFileSync(path, contents)
    })

  // Copy everything else from the default firefox branding directory
  everythingElse.forEach((file) => {
    mkdirpSync(dirname(join(outputPath, file.replace(BRANDING_FF, ''))))
    copyFileSync(file, join(outputPath, file.replace(BRANDING_FF, '')))
  })
}

// =============================================================================
// Exports

export function get(): string[] {
  return readdirSync(BRANDING_DIR).filter((file) =>
    lstatSync(join(BRANDING_DIR, file)).isDirectory()
  )
}

export async function apply(name: string): Promise<void> {
  const configPath = join(BRANDING_DIR, name)
  const outputPath = join(BRANDING_STORE, name)

  checkForFaults(name, configPath)

  const brandingConfig = constructConfig(name)

  // Remove the output path if it exists and recreate it
  ensureEmpty(outputPath)

  await setupImages(configPath, outputPath)
  setupLocale(outputPath, brandingConfig)
  await copyMozFiles(outputPath, brandingConfig)
}