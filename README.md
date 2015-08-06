# JFlo

Extensible document stream processing framework with CLI and Node.js interfaces

## Quick start

```
npm install -g skydom-io/jflo
cd {test_folder}
# git clone https://skydom-io/jflo-samples
cd jflo-samples
jflo --help
```

## CLI usage

### Invocation

### I/O streams

- Standard streams
    - `stdin`
    - `stdout`
    
    `stdout` is JFlo's logical name for payload output - and it's sent to system stdout by default.
    *Nothing* besides payload output is sent to system stdout, so that piping JFlo (and other ETL) processes together
    can always take place without having to worry about interference from error, logging or instrumentation data.
    
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
- From or to a file or pipe
- From or to a TCP socket
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
