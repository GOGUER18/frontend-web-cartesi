// Copyright 2022 Cartesi Pte. Ltd.

// Licensed under the Apache License, Version 2.0 (the "License"); you may not
// use this file except in compliance with the License. You may obtain a copy
// of the license at http://www.apache.org/licenses/LICENSE-2.0

// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
// WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
// License for the specific language governing permissions and limitations
// under the License.

import { ethers } from "ethers";
import React, { useEffect } from "react";
import { useVouchersQuery, useVoucherQuery } from "./generated/graphql";
import { useRollups } from "./useRollups";
import { OutputValidityProofStruct } from "@cartesi/rollups/dist/src/types/contracts/interfaces/IOutput";

type Voucher = {
    id: string;
    index: number;
    destination: string;
    input: any, //{index: number; epoch: {index: number; }
    payload: string;
    proof: any;
};

export const Vouchers: React.FC = () => {
    const [result,reexecuteQuery] = useVouchersQuery();
    const [voucherIdToFetch, setVoucherIdToFetch] = React.useState(String(null));
    const [voucherResult,reexecuteVoucherQuery] = useVoucherQuery({
        variables: { id: voucherIdToFetch }//, pause: !!voucherIdToFetch
    });
    const [voucherToExecute, setVoucherToExecute] = React.useState<any>();
    const { data, fetching, error } = result;
    const rollups = useRollups();

    const getProof = (voucher: Voucher) => {
        console.log("eita",voucherResult,rollups)
        if (rollups) {
            const filter = rollups.outputContract.filters.VoucherExecuted();
            console.log(filter);
            rollups.outputContract.queryFilter(filter).then( (d) => {
                console.log(d);
            })
        }
        setVoucherIdToFetch(voucher.id);
        reexecuteVoucherQuery({ requestPolicy: 'network-only' });
    };
    const executeVoucher = async (voucher: any) => {
        if (rollups && !!voucher.proof) {
            const signer = await (await (await rollups).outputContract.signer).getAddress();

            const proof: OutputValidityProofStruct = {
                ...voucher.proof,
                epochIndex: voucher.input.epoch.index,
                inputIndex: voucher.input.index,
                outputIndex: voucher.index,
            };

            const newVoucherToExecute = {...voucher};
            try {
                // console.log(`Would check: ${JSON.stringify(proof)}`);
                const tx = await rollups.outputContract.executeVoucher( voucher.destination,voucher.payload,proof);
                const receipt = await tx.wait();
                newVoucherToExecute.msg = `voucher executed! (tx="${tx.hash}")`;
                if (receipt.events) {
                    newVoucherToExecute.msg = `${newVoucherToExecute.msg} - resulting events: ${JSON.stringify(receipt.events)}`;
                }
            } catch (e) {
                newVoucherToExecute.msg = `COULD NOT EXECUTE VOUCHER: ${JSON.stringify(e)}`;
            }
            setVoucherToExecute(newVoucherToExecute);
        }
    }
    useEffect( () => {
        if (voucherResult && voucherResult.data){
            setVoucherToExecute(voucherResult.data.voucher);
            // executeVoucher(voucherResult.data.voucher);
            // setVoucherIdToFetch('');
        }
    },[voucherResult, rollups]);

    if (fetching) return <p>Loading...</p>;
    if (error) return <p>Oh no... {error.message}</p>;

    if (!data || !data.vouchers) return <p>No vouchers</p>;

    const vouchers: Voucher[] = data.vouchers.nodes.map((n: any) => {
        let payload = n?.payload;
        if (payload) {
            const decoder = new ethers.utils.AbiCoder();
            payload = ethers.utils.hexDataSlice(payload,4);
            try {
                const decode = decoder.decode(["bytes"], payload)
                const decode2 = decoder.decode(["address", "uint256"], decode[0])
                payload = `Amount: ${ethers.utils.formatEther(decode2[1])} (Native eth) - Address: ${decode2[0]}`;
            } catch (e) {
                try {
                    const decode = decoder.decode(["address","uint256"], payload);
                    payload = `Amount: ${ethers.utils.formatEther(decode[1])} - Address: ${decode[0]}`;
                } catch (e2) {
                    payload = payload;
                }
            }
        } else {
            payload = "(empty)";
        }
        return {
            id: `${n?.id}`,
            index: parseInt(n?.index),
            destination: `${n?.destination ?? ""}`,
            payload: `${payload}`,
            input: n?.input || {epoch:{}},
            proof: null,
        };
    }).sort((b: any, a: any) => {
        if (a.epoch === b.epoch) {
            if (a.input === b.input) {
                return a.voucher - b.voucher;
            } else {
                return a.input - b.input;
            }
        } else {
            return a.epoch - b.epoch;
        }
    });

    // const forceUpdate = useForceUpdate();
    return (
        <div>
            <p>Voucher to execute</p>
        {voucherToExecute ? <table>
            <thead>
                <tr>
                    <th>Epoch</th>
                    <th>Input Index</th>
                    <th>Voucher Index</th>
                    <th>Voucher Id</th>
                    <th>Destination</th>
                    <th>Action</th>
                    {/* <th>Payload</th> */}
                    {/* <th>Proof</th> */}
                    <th>Msg</th>
                </tr>
            </thead>
            <tbody>
                <tr key={`${voucherToExecute.input.epoch.index}-${voucherToExecute.input.index}-${voucherToExecute.index}`}>
                    <td>{voucherToExecute.input.epoch.index}</td>
                    <td>{voucherToExecute.input.index}</td>
                    <td>{voucherToExecute.index}</td>
                    <td>{voucherToExecute.id}</td>
                    <td>{voucherToExecute.destination}</td>
                    <td>
                        <button disabled={!voucherToExecute.proof} onClick={() => executeVoucher(voucherToExecute)}>{voucherToExecute.proof ? "Execute voucher" : "No proof yet"}</button>
                    </td>
                    {/* <td>{voucherToExecute.payload}</td> */}
                    {/* <td>{voucherToExecute.proof}</td> */}
                    <td>{voucherToExecute.msg}</td>
                </tr>
            </tbody>
        </table> : <p>Nothing yet</p>}
            <button onClick={() => reexecuteQuery({ requestPolicy: 'network-only' })}>
                Reload
            </button>
            <table>
                <thead>
                    <tr>
                        <th>Epoch</th>
                        <th>Input Index</th>
                        <th>Voucher Index</th>
                        <th>Voucher Id</th>
                        <th>Destination</th>
                        <th>Action</th>
                        <th>Payload</th>
                        {/* <th>Proof</th> */}
                    </tr>
                </thead>
                <tbody>
                    {vouchers.length === 0 && (
                        <tr>
                            <td colSpan={4}>no vouchers</td>
                        </tr>
                    )}
                    {vouchers.map((n: any) => (
                        <tr key={`${n.input.epoch.index}-${n.input.index}-${n.index}`}>
                            <td>{n.input.epoch.index}</td>
                            <td>{n.input.index}</td>
                            <td>{n.index}</td>
                            <td>{n.id}</td>
                            <td>{n.destination}</td>
                            <td>
                                <button onClick={() => getProof(n)}>Get Proof</button>
                            </td>
                            <td>{n.payload}</td>
                            {/* <td>
                                <button disabled={!!n.proof} onClick={() => executeVoucher(n)}>Execute voucher</button>
                            </td> */}
                        </tr>
                    ))}
                </tbody>
            </table>

        </div>
    );
};