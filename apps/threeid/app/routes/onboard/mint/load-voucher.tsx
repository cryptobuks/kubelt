import { LoaderFunction } from '@remix-run/cloudflare'
import { json } from '@remix-run/cloudflare'
import { redirect } from 'react-router'
import {
  fetchVoucher,
  getCachedVoucher,
  putCachedVoucher,
} from '~/helpers/voucher'
import { Visibility } from '~/utils/galaxy.server'
import { getUserSession } from '~/utils/session.server'
import { gatewayFromIpfs } from '~/helpers/gateway-from-ipfs'
import { getGalaxyClient } from '~/helpers/galaxyClient'

export const loader: LoaderFunction = async ({ request, params }) => {
  const session = await getUserSession(request)

  // TODO: remove chain id and redirect to /auth
  if (!session || !session.has('jwt')) {
    return json(null, {
      status: 500,
    })
  }

  const jwt = session.get('jwt')

  const url = new URL(request.url)
  const queryAddress = url.searchParams.get('address')
  const address = queryAddress ?? session.get('address')

  let voucher = await getCachedVoucher(address)

  const galaxyClient = await getGalaxyClient()
  const profileRes = await galaxyClient.getProfile(undefined, {
    'KBT-Access-JWT-Assertion': jwt,
  })
  const prof = profileRes.profile

  if (voucher) {
    if (!voucher.minted && prof?.pfp?.isToken) {
      // If minted update voucher cache
      voucher = await putCachedVoucher(address, {
        ...voucher,
        minted: true,
      })
    }
  } else {
    try {
      voucher = await fetchVoucher({ address })
      voucher = await putCachedVoucher(address, voucher)
    } catch (e) {
      console.error('ERROR FETCHING VOUCHER', e)
      // TODO: it is unlikely a user would have no voucher and no profile
      // if this is an issue we should handle it here
    }
  }

  if (!prof?.pfp) {
    await galaxyClient.updateProfile(
      {
        profile: {
          pfp: {
            image: gatewayFromIpfs(voucher?.metadata?.image),
          },
          cover: gatewayFromIpfs(voucher?.metadata?.cover),
        },
        visibility: Visibility.Public,
      },
      {
        'KBT-Access-JWT-Assertion': jwt,
      }
    )
  }

  if (voucher.minted) {
    return redirect('/onboard/ens')
  }

  return json(voucher)
}
