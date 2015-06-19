# JFlo

Extensible JSON stream processing framework with CLI and Node.js interfaces

## Quick start

```
npm install -g skydom-io/jflo
jflo --help
```

## CLI usage

### Invocation

### I/O streams

- Standard streams
    - `stdin`
    - `stdout`
    - `stderr`
- Auxiliary payload streams
    - `in.{name}`
    - `out.{name}`
    - `inout.{name}` (Duplex)
- Instrumentation streams
    - `logger`
    - `metrics`
    - `control`

#### Stream redirection
- From a file or pipe
- From a TCP socket
- To a file or pipe
- To a TCP socket
- Duplex binding

### Plug-in installation
`npm install {jflo-plugin-name}`
`jflo {plugin-name} --help` 

## Usage as a node.js library

## Configuration

### jflofile.js

#### Default values

## Writing plugins

### Filters

### Parsers

### Formatters
