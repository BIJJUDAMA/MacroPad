use crate::{IpcCommand, IpcResponse};
use thiserror::Error;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};

#[derive(Debug, Error)]
pub enum ClientError {
    #[error("could not connect to daemon — is it running?")]
    NotRunning,
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("json error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("daemon error: {0}")]
    Daemon(String),
}

pub struct IpcClient {
    #[cfg(windows)]
    pipe: tokio::net::windows::named_pipe::NamedPipeClient,
    #[cfg(not(windows))]
    stream: tokio::net::UnixStream,
}

impl IpcClient {
    #[cfg(windows)]
    pub async fn connect() -> Result<Self, ClientError> {
        use tokio::net::windows::named_pipe::ClientOptions;

        let pipe = ClientOptions::new()
            .open(crate::PIPE_NAME)
            .map_err(|_| ClientError::NotRunning)?;
        Ok(Self { pipe })
    }

    #[cfg(not(windows))]
    pub async fn connect() -> Result<Self, ClientError> {
        let stream = tokio::net::UnixStream::connect(crate::SOCKET_PATH)
            .await
            .map_err(|_| ClientError::NotRunning)?;
        Ok(Self { stream })
    }

    pub async fn send(&mut self, cmd: IpcCommand) -> Result<IpcResponse, ClientError> {
        let mut json = serde_json::to_string(&cmd)?;
        println!("GUI SENDING IPC: {}", json);
        json.push('\n');

        #[cfg(windows)]
        {
            self.pipe.write_all(json.as_bytes()).await?;
            let mut reader = BufReader::new(&mut self.pipe);
            let mut line   = String::new();
            reader.read_line(&mut line).await?;
            let response: IpcResponse = serde_json::from_str(line.trim())?;
            Ok(response)
        }

        #[cfg(not(windows))]
        {
            let (reader, mut writer) = self.stream.split();
            writer.write_all(json.as_bytes()).await?;
            let mut reader = BufReader::new(reader);
            let mut line   = String::new();
            reader.read_line(&mut line).await?;
            let response: IpcResponse = serde_json::from_str(line.trim())?;
            Ok(response)
        }
    }
}

/// Convenience function: connect, send one command, return the response.
pub async fn send_command(cmd: IpcCommand) -> Result<IpcResponse, ClientError> {
    let mut client = IpcClient::connect().await?;
    client.send(cmd).await
}
