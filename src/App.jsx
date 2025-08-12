import TokenLaunchpad from './components/TokenLaunchpad'
import "@solana/wallet-adapter-react-ui/styles.css"
import { ConnectionContext, ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react"
import { WalletModalProvider, WalletMultiButton, WalletDisconnectButton } from '@solana/wallet-adapter-react-ui'
import { useState } from 'react'

function App() {

  const [mintAddress, setMintAddress] = useState("")

  const [isMinted, setIsMinted] = useState(false)

  const [lpCreated, setLpCreated] = useState(false)

  const [nextClicked, setNextClicked] = useState(false)

  return (

    <ConnectionProvider endpoint={"https://api.devnet.solana.com"}>

      <WalletProvider wallets={[]} autoConnect>

        <WalletModalProvider>

          {!nextClicked && <div>
            
            <WalletMultiButton></WalletMultiButton>

            <WalletDisconnectButton></WalletDisconnectButton>
          
          </div>}

          <TokenLaunchpad mintAddress={mintAddress} setMintAddress={setMintAddress} isMinted={isMinted} setIsMinted={setIsMinted} lpCreated={lpCreated} setLpCreated={setLpCreated} nextClicked={nextClicked} setNextClicked={setNextClicked}></TokenLaunchpad>

        </WalletModalProvider>
      
      </WalletProvider>


    </ConnectionProvider>

  )
}

export default App
