package kr.re.keti.mobiussampleapp_v25.layouts

import android.graphics.Rect
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.fragment.app.activityViewModels
import androidx.recyclerview.widget.GridLayoutManager
import androidx.recyclerview.widget.RecyclerView
import kr.re.keti.mobiussampleapp_v25.data.AE
import kr.re.keti.mobiussampleapp_v25.databinding.FragmentDeviceListBinding
import kr.re.keti.mobiussampleapp_v25.databinding.ItemRecyclerDeviceBinding

class DeviceListFragment : Fragment() {
    // Inner Class For Decorating Recycler View of Device List
    internal inner class ItemPadding(private val divWidth: Int?, private val divHeight: Int?) : RecyclerView.ItemDecoration() {
        override fun getItemOffsets(
            outRect: Rect, view: View,
            parent: RecyclerView, state: RecyclerView.State
        ) {
            super.getItemOffsets(outRect, view, parent, state)
            if (divWidth != null) {
                outRect.left = divWidth
                outRect.right = divWidth
            }
            if(divHeight != null) {
                outRect.top = divHeight
                outRect.bottom = divHeight
            }
        }
    }

    // Inner Class For Setting Adapter in Device Recycler View
    inner class DeviceAdapter(private val deviceList: MutableList<AE>) : RecyclerView.Adapter<DeviceAdapter.ViewHolder>() {
        override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
            return ViewHolder(ItemRecyclerDeviceBinding.inflate(LayoutInflater.from(parent.context), parent, false))
        }

        override fun onBindViewHolder(holder: ViewHolder, position: Int) {
            holder.bind(deviceList[position])
        }

        override fun getItemCount(): Int {
            return deviceList.size
        }

        fun addData(){
            notifyItemInserted(viewModel.mutableDeviceList.lastIndex)
        }

        inner class ViewHolder(val binding: ItemRecyclerDeviceBinding): RecyclerView.ViewHolder(binding.root) {
            fun bind(device: AE){
                binding.deviceName.text = device.applicationName
                binding.deviceStatus.text = "Registered"
            }
        }
    }

    // Field for this fragment
    private var _binding: FragmentDeviceListBinding? = null
    private val binding get() = _binding!!
    private var _adapter: DeviceAdapter? = null
    private val adapter get() = _adapter!!

    private val viewModel: MainViewModel by activityViewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        _adapter = DeviceAdapter(viewModel.mutableDeviceList)
        viewModel.addedServiceAEName.observe(this) {
            adapter.addData()
        }
    }

    // onCreateView -> Declare layout
    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        // Inflate the layout for this fragment
        _binding = FragmentDeviceListBinding.inflate(inflater, container, false)
        return binding.root
    }

    // onViewCreated -> Method Declaration
    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        binding.deviceRecyclerView.setHasFixedSize(false)
        binding.deviceRecyclerView.adapter = adapter
        binding.deviceRecyclerView.layoutManager = GridLayoutManager(context, 2, RecyclerView.VERTICAL, false)
        binding.deviceRecyclerView.addItemDecoration(ItemPadding(5,5))
    }

    override fun onDestroy() {
        super.onDestroy()

        _binding = null
        _adapter = null
    }
}