import { useConnection, useWallet } from "@solana/wallet-adapter-react"
import { useState } from 'react'
import { Keypair, Transaction, SystemProgram, PublicKey } from "@solana/web3.js"
import { TOKEN_PROGRAM_ID, getMintLen, ExtensionType, LENGTH_SIZE, TYPE_SIZE, TOKEN_2022_PROGRAM_ID, createInitializeMetadataPointerInstruction, createInitializeMintInstruction, getAssociatedTokenAddressSync, createAssociatedTokenAccountInstruction, createMintToInstruction, NATIVE_MINT } from "@solana/spl-token"
import { createInitializeInstruction, pack } from "@solana/spl-token-metadata"
import axios from "axios"
import BN from "bn.js"
import { InstructionType, makeCreateCpmmPoolInInstruction, Owner, TxBuilder, Raydium, DEVNET_PROGRAM_ID, getCpmmPdaAmmConfigId, getCreatePoolKeys, getATAAddress, TxVersion } from "@raydium-io/raydium-sdk-v2"

export default function TokenLaunchpad({mintAddress, setMintAddress, isMinted, setIsMinted, lpCreated, setLpCreated, nextClicked, setNextClicked}) {

    const wallet = useWallet()

    const [name, setName] = useState("")

    const [symbol, setSymbol] = useState("")

    const [url, setUrl] = useState("")

    const [uri, setUri] = useState("")

    const [mintKP, setMintKP] = useState(null)

    const [tokens, setTokens] = useState([{name: "SOL", mint: "So11111111111111111111111111111111111111111", decimals: 9},
        
    {name: "USDC", mint: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU", decimals: 6},

    {name:"DONKE", mint: "5739VA6z6U2MHFV9pWy2burqTbez4EdexNuJ4RFi6qNg", decimals: 9}])

    const [selectedToken, setSelectedToken] = useState(tokens[0].mint)

    const [poolPKey, setPoolPKey] = useState("")

    const { connection } = useConnection()

    async function createToken() {

        let metadata = {name: name, symbol: symbol, image: url}

        let pinata_uri

        try {

            const {data} = await axios.post('http://localhost:3000/uri', metadata)

            pinata_uri = data.uri

            setUri(pinata_uri)
        
        } catch(err) {

            console.log(err)

            alert("Error in creating the pinata uri. Please try again!")

            return
        }

        const mintKeypair = Keypair.generate()

        const mintLen = getMintLen([ExtensionType.MetadataPointer])

        metadata = {mint: mintKeypair.publicKey, name: name, symbol: symbol, uri: pinata_uri, additionalMetadata: []}

        const metadataLen = TYPE_SIZE + LENGTH_SIZE + pack(metadata).length

        const lamports = await connection.getMinimumBalanceForRentExemption(mintLen + metadataLen)

        const transaction = new Transaction().add(

            SystemProgram.createAccount({

                fromPubkey: wallet.publicKey,
                newAccountPubkey: mintKeypair.publicKey,
                space: mintLen,
                lamports,
                programId: TOKEN_2022_PROGRAM_ID

            }),

            createInitializeMetadataPointerInstruction(mintKeypair.publicKey, wallet.publicKey, mintKeypair.publicKey, TOKEN_2022_PROGRAM_ID),

            createInitializeMintInstruction(mintKeypair.publicKey, 9, wallet.publicKey, null, TOKEN_2022_PROGRAM_ID),

            createInitializeInstruction({

                programId: TOKEN_2022_PROGRAM_ID,
                mint: mintKeypair.publicKey,
                metadata: mintKeypair.publicKey,
                name: metadata.name,
                symbol: metadata.symbol,
                uri: metadata.uri,
                mintAuthority: wallet.publicKey,
                updateAuthority: wallet.publicKey
            })

        )

        transaction.feePayer = wallet.publicKey
        
        transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash

        transaction.partialSign(mintKeypair)

        try {

            await wallet.sendTransaction(transaction, connection)
        
        } catch(err) {

            alert("Transaction failed, please try again!")

            return
        }

        setMintAddress(mintKeypair.publicKey.toBase58())

        setMintKP(mintKeypair)

    }

    async function mintTokens() {

        const associatedTokenAddress = getAssociatedTokenAddressSync(mintKP.publicKey, wallet.publicKey, false, TOKEN_2022_PROGRAM_ID)

        const transaction = new Transaction().add(

            createAssociatedTokenAccountInstruction(wallet.publicKey, associatedTokenAddress, wallet.publicKey, mintKP.publicKey, TOKEN_2022_PROGRAM_ID)

        )

        try {

            await wallet.sendTransaction(transaction, connection)
        
        } catch(err) {

            console.log(err)

            alert("Error in creating associated token account.")

            return
        }

        const tx = new Transaction().add(

            createMintToInstruction(mintKP.publicKey, associatedTokenAddress, wallet.publicKey, 10000000000, [], TOKEN_2022_PROGRAM_ID)
        )

        try {

            await wallet.sendTransaction(tx, connection)


        } catch(err) {

            alert("Error in minting the tokens, please try again!")

            return
        }

        setIsMinted(true)
    }

    function takeBack() {

        setName("")

        setSymbol("")

        setUrl("")

        setUri("")

        setMintAddress("")

        setIsMinted(false)

        setMintKP(null)

        setLpCreated(false)

        setNextClicked(false)
    }

    async function createPool() {

        const payer = wallet.publicKey

        let mintTokenFunc = mintAddress

        let tokenFunc = selectedToken

        let useSOLBalance = false

        if(mintTokenFunc === "So11111111111111111111111111111111111111111") {

            mintTokenFunc = "So11111111111111111111111111111111111111112"

            useSOLBalance = true

        }

        if(tokenFunc === "So11111111111111111111111111111111111111111") {

            tokenFunc = "So11111111111111111111111111111111111111112"

            useSOLBalance = true

        }


        const isFront = new BN(new PublicKey(mintTokenFunc).toBuffer()).lte(new BN(new PublicKey(tokenFunc).toBuffer()))


        let [mintA, mintB] = isFront ? [mintTokenFunc, tokenFunc] : [tokenFunc, mintTokenFunc]


        const mintTokenAmount = new BN(1_000_000_000)

        const tokenAmount = new BN(1_000_000_000)

        const [mintAAmount, mintBAmount] = isFront ? [mintTokenAmount, tokenAmount] : [tokenAmount, mintTokenAmount]

        const mintAUseSolBalance = useSOLBalance && mintA === NATIVE_MINT.toBase58()

        const mintBUseSolBalance = useSOLBalance && mintB === NATIVE_MINT.toBase58()

        const [mintAPubkey, mintBPubkey] = [new PublicKey(mintA), new PublicKey(mintB)]

        const owner = new Owner(wallet.publicKey)

        const txBuilder = new TxBuilder({connection,
            
            feePayer: wallet.publicKey,
            
            owner,
            
            cluster: 'devnet'
        })


        const raydium = await Raydium.load({

            connection,
            
            owner: wallet.publicKey,

            cluster: 'devent'

        })


        const { account: userVaultA, instructionParams: userVaultAInstruction } = await raydium.account.getOrCreateTokenAccount({

            mint: mintAPubkey,

            tokenProgram: mintA === "So11111111111111111111111111111111111111112" || mintA === "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU" ? TOKEN_PROGRAM_ID : TOKEN_2022_PROGRAM_ID,

            owner: raydium.ownerPubKey,

            createInfo: mintAUseSolBalance ? {payer: payer, amount: mintAAmount} : undefined,

            notUseTokenAccount: mintAUseSolBalance,

            skipCloseAccount: !mintAUseSolBalance,

            associatedOnly: mintAUseSolBalance ? false : true,

            checkCreateATAOwner: true

        })


        txBuilder.addInstruction(userVaultAInstruction || {})


        const { account: userVaultB, instructionParams: userVaultBInstruction } = await raydium.account.getOrCreateTokenAccount({

            mint: mintBPubkey,

            tokenProgram: mintB === "So11111111111111111111111111111111111111112" || mintB === "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU" ? TOKEN_PROGRAM_ID : TOKEN_2022_PROGRAM_ID,

            owner: raydium.ownerPubKey,

            createInfo: mintBUseSolBalance ? {payer: payer, amount: mintBAmount} : undefined,

            notUseTokenAccount: mintBUseSolBalance,

            skipCloseAccount: !mintBUseSolBalance,

            associatedOnly: mintBUseSolBalance ? false : true,

            checkCreateATAOwner: true
        })


        txBuilder.addInstruction(userVaultBInstruction || {})


        if(userVaultA === undefined || userVaultB === undefined) {

            alert("You don't have some token account")

            return
        }


        const feeConfigs = await raydium.api.getCpmmConfigs()

        feeConfigs.forEach((config) => {

            config.id = getCpmmPdaAmmConfigId(DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_PROGRAM, config.index).publicKey.toBase58()
        
        })


        const poolKeys = getCreatePoolKeys({

            programId: DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_PROGRAM,

            configId: new PublicKey(feeConfigs[0].id),

            mintA: mintAPubkey,

            mintB: mintBPubkey
        
        })

        const poolId = poolKeys.poolId

        const info = await connection.getAccountInfo(poolId)

        if(info) {

            alert("This pool already exists!")

            return
        }

        const startTime = new BN(0)


        txBuilder.addInstruction({

            instructions: [

                makeCreateCpmmPoolInInstruction(

                    DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_PROGRAM,

                    raydium.ownerPubKey,

                    new PublicKey(feeConfigs[0].id),

                    poolKeys.authority,

                    poolKeys.poolId,

                    mintAPubkey,

                    mintBPubkey,

                    poolKeys.lpMint,

                    userVaultA,

                    userVaultB,

                    getATAAddress(raydium.ownerPubKey, poolKeys.lpMint).publicKey,

                    poolKeys.vaultA,

                    poolKeys.vaultB,

                    DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_FEE_ACC,

                    new PublicKey(mintA === "So11111111111111111111111111111111111111112" || mintA === "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU" ? TOKEN_PROGRAM_ID : TOKEN_2022_PROGRAM_ID),

                    new PublicKey(mintB === "So11111111111111111111111111111111111111112" || mintB === "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU" ? TOKEN_PROGRAM_ID : TOKEN_2022_PROGRAM_ID),

                    poolKeys.observationId,

                    mintAAmount,

                    mintBAmount,

                    startTime

                )
            ],

            instructionTypes: [InstructionType.CpmmCreatePool]
        })


        const tx = await txBuilder.versionBuild({

            txVersion: TxVersion.V0,

            extInfo: {

                address: {

                     ...poolKeys, 
                    
                    mintA, 
                        
                    mintB, 
                        
                    programId: DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_PROGRAM, 
                        
                    poolFeeAccount: DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_FEE_ACC, feeConfig: feeConfigs[0]
                }
            }

        })

        const { transaction } = tx

        transaction.feePayer = wallet.publicKey

        const latestBlockhash = await connection.getLatestBlockhash()

        transaction.recentBlockhash = latestBlockhash.blockhash


        try {

            await wallet.sendTransaction(transaction, connection)


        } catch(err) {

            console.error(err)

            return
        }

        setPoolPKey(poolKeys.poolId.toBase58())
    
        setLpCreated(true)

    }


    function nextFunc() {

        setNextClicked(true)
    }

    return (

        <div>

            {mintAddress === "" && <div>

                <h1>Token Launchpad</h1>

                <input style = {{width: 300}} type="text" placeholder="Your token name: " onChange={(e) => setName(e.target.value)}></input>

                <br></br>

                <input style={{width: 300}} type="text" placeholder="Your token symbol:" onChange={(e) => setSymbol(e.target.value)}></input>

                <br></br>

                <input style={{width: 300}} type="text" placeholder="Your token image url:" onChange={(e) => setUrl(e.target.value)}></input>

                <br></br>

                <button onClick={createToken} disabled={!wallet.connected || name === "" || symbol === "" || url === ""} title="Connect your wallet and enter token details">Create your token!</button>

                </div>
            }

            {mintAddress !== "" && !isMinted && <div>

                <div>Your token has been minted at address: {mintAddress}</div>

                <div>Your Pinata metadata uri is: {uri}</div>

                <button onClick={mintTokens}>Mint your tokens!</button>
                
            </div>}


            {isMinted && !lpCreated && <div>

                <div>Tokens have been minted to your wallet address! Please check.</div>

                <label>Select a token to pair with:</label>

                <select value={selectedToken} onChange={(e) => setSelectedToken(e.target.value)}>

                    {tokens.map((token, index) => (

                        <option key={index} value={token.mint}>{token.name}</option>
                    ))}

                </select>

                <br></br>

                <button onClick={createPool}>Create the Liquidity pool on Raydium</button>   
                
            </div>}

            {lpCreated && !nextClicked && <div>

                <div>Liquidity pool has been created on Raydium between {name} and {selectedToken.name} at {poolPKey}!</div>

                <div>Create another pool!</div>

                <br></br>

                <label>Select a token to pair with:</label>

                <select value={selectedToken} onChange={(e) => setSelectedToken(e.target.value)}>

                    {tokens.map((token, index) => (

                        <option key={index} value={token.mint}>{token.name}</option>
                    ))}

                </select>

                <br></br>
                
                <button onClick={createPool}>Create the liquidity pool!</button>

                <br></br>

                <button onClick={nextFunc}>Next</button>

            </div>}

            {nextClicked && <div>
                
                <button onClick={takeBack}>Create more tokens!</button> 

            </div>}

        </div>
    )
}