package kr.re.keti.mobiussampleapp_v25.layouts

import android.content.Context
import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.ViewModel
import kr.re.keti.mobiussampleapp_v25.database.RegisteredAE
import kr.re.keti.mobiussampleapp_v25.database.RegisteredAEDatabase

class MainViewModel: ViewModel() {
    private val mutableServiceAEAdd = MutableLiveData<Int?>()
    private val mutableServiceAEUpdate = MutableLiveData<Int?>()
    private val mutableDeviceList = mutableListOf<RegisteredAE>()
    private lateinit var db: RegisteredAEDatabase

    val serviceAEAdd: LiveData<Int?> get() = mutableServiceAEAdd
    val serviceAEUpdate: LiveData<Int?> get() = mutableServiceAEUpdate
    val database: RegisteredAEDatabase get() = db

    private var MQTT_Req_Topic = ""
    private var MQTT_Resp_Topic = ""
    val mqttReqTopic get() = MQTT_Req_Topic
    val mqttRespTopic get() = MQTT_Resp_Topic

    fun setDatabase(context: Context){db = RegisteredAEDatabase.getInstance(context)}

    fun addServiceAE(position: Int?){
        mutableServiceAEAdd.value = position
    }

    fun updateServiceAE(position: Int?){
        mutableServiceAEUpdate.value = position
    }

    fun getDeviceList(): MutableList<RegisteredAE> {
        return mutableDeviceList
    }

    fun setMQTTTopic(req: String, resp: String){
        MQTT_Req_Topic = req
        MQTT_Resp_Topic = resp
    }

}